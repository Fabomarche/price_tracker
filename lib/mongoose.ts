import mongoose from 'mongoose'

let connection: Promise<typeof mongoose> | null = null

function databaseErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : ''

    if (/ENOTFOUND|querySrv/i.test(message)) {
        return 'Could not connect to the database. The Atlas cluster host was not found. Recreate the free M0 cluster and update MONGODB_URI.'
    }

    if (/authentication failed|bad auth|not authorized/i.test(message)) {
        return 'Could not connect to the database. The MongoDB credentials were rejected. Update MONGODB_URI.'
    }

    return 'Could not connect to the database. Check MONGODB_URI and that the Atlas cluster is running.'
}

export const connectToDB = async () => {
    mongoose.set('strictQuery', true)

    if (!process.env.MONGODB_URI) {
        throw new Error('Could not connect to the database. MONGODB_URI is missing.')
    }

    if (mongoose.connection.readyState === 1) return

    if (!connection) {
        connection = mongoose
            .connect(process.env.MONGODB_URI, {
                dbName: 'price_wise',
            })
            .then((mongooseConnection) => {
                console.log('MongoDB connected')
                return mongooseConnection
            })
            .catch((error: unknown) => {
                connection = null
                console.log(error)
                throw new Error(databaseErrorMessage(error))
            })
    }

    await connection
}
