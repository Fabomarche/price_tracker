'use client'

import { scrapeAndStoreProduct } from "@/lib/actions"
import { useState, FormEvent } from "react"

const isValidAmazonProductURL = (url: string) => {
    try {
        const parsedURL = new URL(url)
        const hostname = parsedURL.hostname

        if (hostname.includes('amazon.com') ||
            hostname.includes('amazon.') ||
            hostname.endsWith('amazon')
        ) {
            return true
        }
    } catch (error) {
        return false
    }
}

const Searchbar = () => {
    const [searchPrompt, setSearchPrompt] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState('')



    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const isValidLink = isValidAmazonProductURL(searchPrompt)

        if (!isValidLink) return alert('Please provide a valid Amazon link')

        try {
            setIsLoading(true)
            setMessage('')

            const result = await scrapeAndStoreProduct(searchPrompt)

            if (result?.error) {
                setMessage(result.error)
            }
        } catch (error) {
            console.log(error)
            setMessage('Could not complete the search. Products already saved are still listed below.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form
            className='flex flex-wrap gap-4 mt-12'
            onSubmit={handleSubmit}
        >
            <input
                type='text'
                value={searchPrompt}
                onChange={e => setSearchPrompt(e.target.value)}
                placeholder="Enter product link"
                className="searchbar-input"
            />
            <button
                type="submit"
                className="searchbar-btn"
                disabled={searchPrompt === ''}
            >
                {isLoading ? 'Searching...' : 'Search'}
            </button>
            {message ? (
                <p className="w-full text-base text-primary" role="alert">
                    {message}
                </p>
            ) : null}
        </form>
    )
}

export default Searchbar