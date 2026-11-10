import Navbar from '@/components/Navbar'
import './globals.css'
import type { Metadata } from 'next'
import localFont from 'next/font/local'

const inter = localFont({
  src: './fonts/InterLatin.woff2',
  weight: '100 900',
  style: 'normal',
})

const spaceGrotesk = localFont({
  src: './fonts/SpaceGroteskLatin.woff2',
  weight: '300 700',
  style: 'normal',
})

export const metadata: Metadata = {
  title: 'Pricewise',
  description: 'Track product prices effortlessly and save money on your online shopping.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className='max-w-10xl mx-auto'>
          <Navbar />
          {children}
        </main>
      </body>
    </html>
  )
}
