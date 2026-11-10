"use server"

import axios, { type AxiosRequestConfig } from "axios"
import * as cheerio from "cheerio"
import { extractCurrency, extractDescription, extractPrice, parsePrice } from "../utils"

const SCRAPE_BLOCKED_MESSAGE =
    "Could not scrape this product. Amazon blocked the request, so nothing was saved. Products already saved are still listed below."
const SCRAPE_PRICE_MESSAGE =
    "Could not find a price for this product, so nothing was saved."
const SCRAPE_DETAILS_MESSAGE =
    "Could not scrape this product. The page did not include product details, so nothing was saved."

function brightDataProxy(): AxiosRequestConfig["proxy"] {
    const username = process.env.BRIGHT_DATA_USERNAME?.trim()
    const password = process.env.BRIGHT_DATA_PASSWORD?.trim()

    // Credentials are optional. Direct requests are used when either value is missing.
    if (!username || !password) return false

    const sessionId = (1000000 * Math.random()) | 0

    return {
        protocol: "http",
        host: "brd.superproxy.io",
        port: 22225,
        auth: {
            username: `${username}-session-${sessionId}`,
            password,
        },
    }
}

function readImageUrls(images: string) {
    try {
        const parsed = JSON.parse(images) as Record<string, unknown>
        return Object.keys(parsed)
    } catch {
        console.log("Could not parse Amazon image payload")
        return []
    }
}

export async function scrapeAmazonProduct(url: string) {
    if (!url) return

    const proxy = brightDataProxy()

    console.log(
        proxy
            ? "Scraping Amazon through the optional Bright Data proxy"
            : "Scraping Amazon directly without a proxy"
    )

    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
                "Upgrade-Insecure-Requests": "1",
            },
            timeout: 12000,
            proxy,
        })

        const $ = cheerio.load(response.data)
        const title = $("#productTitle").text().trim()
        const pageText = typeof response.data === "string" ? response.data : ""
        const blocked =
            !title &&
            /Robot Check|captcha|automated access|not a robot/i.test(pageText)

        if (blocked) {
            throw new Error(SCRAPE_BLOCKED_MESSAGE)
        }

        const currentPrice = parsePrice(
            extractPrice(
                $(".priceToPay span.a-price-whole"),
                $("a.size.base.a-color-price"),
                $(".a-button-selected .a-color-base"),
                $(".a-price.a-text-price")
            )
        )

        const originalPrice = parsePrice(
            extractPrice(
                $("#priceblock_ourprice"),
                $(".a-price.a-text-price span.a-offscreen"),
                $("#listPrice"),
                $("#priceblock_dealprice"),
                $(".a-size-base.a-color-price")
            )
        )

        const resolvedCurrent = currentPrice ?? originalPrice
        const resolvedOriginal = originalPrice ?? currentPrice

        if (resolvedCurrent == null || resolvedOriginal == null) {
            throw new Error(title ? SCRAPE_PRICE_MESSAGE : SCRAPE_DETAILS_MESSAGE)
        }

        const outOfStock =
            $("#availability span").text().trim().toLowerCase() === "currently unavailable"

        const images =
            $("#imgBlkFront").attr("data-a-dynamic-image") ||
            $("#landingImage").attr("data-a-dynamic-image") ||
            "{}"

        const imageUrls = readImageUrls(images)
        const currency = extractCurrency($(".a-price-symbol"))
        const discountRate = $(".savingsPercentage").text().replace(/[-%]/g, "")
        const parsedDiscount = Number(discountRate)
        const description = extractDescription($)

        if (!title || !imageUrls[0]) {
            throw new Error(SCRAPE_DETAILS_MESSAGE)
        }

        const data = {
            url,
            currency: currency || "$",
            image: imageUrls[0],
            title,
            currentPrice: resolvedCurrent,
            originalPrice: resolvedOriginal,
            priceHistory: [],
            discountRate: Number.isFinite(parsedDiscount) && parsedDiscount > 0 ? parsedDiscount : 0,
            category: "category",
            reviewsCount: 100,
            stars: 4.5,
            isOutOfStock: outOfStock,
            description,
            lowestPrice: resolvedCurrent,
            highestPrice: resolvedOriginal,
            averagePrice: resolvedCurrent,
        }

        return data
    } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith("Could not")) {
            throw error
        }

        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        const code = axios.isAxiosError(error) ? error.code : undefined
        console.log(`Failed to scrape product: ${status ?? code ?? "unknown error"}`)

        if (status === 404) {
            throw new Error("Could not scrape this product. Amazon returned 404, so nothing was saved.")
        }

        throw new Error(SCRAPE_BLOCKED_MESSAGE)
    }
}
