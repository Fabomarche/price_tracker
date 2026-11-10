"use server"

import { revalidatePath } from "next/cache"
import Product from "../models/product.model"
import { connectToDB } from "../mongoose"
import { scrapeAmazonProduct } from "../scraper"
import { getAveragePrice, getHighestPrice, getLowestPrice, isPositivePrice } from "../utils"
import { User } from "@/types"
import { generateEmailBody, sendEmail } from "../nodemailer"

export async function scrapeAndStoreProduct(productUrl: string) {
    if (!productUrl) {
        return { error: "Could not scrape this product. Please provide a product link." }
    }

    try {
        await connectToDB()

        const scrapedProduct = await scrapeAmazonProduct(productUrl)

        if (!scrapedProduct || !isPositivePrice(scrapedProduct.currentPrice)) {
            return {
                error: "Could not scrape this product, so nothing was saved. Products already saved are still listed below.",
            }
        }

        let product: any = scrapedProduct

        const existingProduct = await Product.findOne({ url: scrapedProduct.url })

        if (existingProduct) {
            const updatedPriceHistory: any = [
                ...existingProduct.priceHistory,
                { price: scrapedProduct.currentPrice }
            ]

            product = {
                ...scrapedProduct,
                priceHistory: updatedPriceHistory,
                lowestPrice: getLowestPrice(updatedPriceHistory),
                highestPrice: getHighestPrice(updatedPriceHistory),
                averagePrice: getAveragePrice(updatedPriceHistory)
            }
        }

        const newProduct = await Product.findOneAndUpdate(
            { url: scrapedProduct.url },
            product,
            { upsert: true, new: true }
        );

        revalidatePath(`/products/${newProduct._id}`)
        return {}
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Could not save this product."
        console.log(message)

        if (message.startsWith("Could not")) {
            return { error: message }
        }

        return {
            error: "Could not save this product. Products already saved are still listed below.",
        }
    }
}

export async function getProductById(productId: string) {
    try {
        await connectToDB()

        const product = await Product.findOne({ _id: productId })

        if (!product || !isPositivePrice(product.currentPrice)) return null

        return product
    } catch (error) {
        console.log(error)
    }
}

export async function getAllProducts() {
    try {
        await connectToDB()

        const products = await Product.find({ currentPrice: { $gt: 0 } })

        return products
    } catch (error) {
        console.log(error)
    }
}

export async function getSimilarProducts(productId: string) {
    try {
        await connectToDB()

        const currentProduct = await Product.findById(productId)

        if (!currentProduct) return null

        const similarProducts = await Product.find({
            _id: { $ne: productId },
            currentPrice: { $gt: 0 },
        }).limit(3)

        return similarProducts
    } catch (error) {
        console.log(error)
    }
}

export async function addUserEmailToProduct(productId: string, userEmail: string) {
    try {
        await connectToDB()

        const product = await Product.findById(productId)
        if (!product) return;

        const userExist = product.users.some((user: User) => user.email === userEmail)

        if (!userExist) {
            product.users.push({ email: userEmail })

            await product.save()

            const emailContent = await generateEmailBody(product, "WELCOME")

            await sendEmail(emailContent, [userEmail])

        }

    } catch (error) {
        console.log(error)
    }
}