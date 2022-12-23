
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import avitoApi from './avitoApi/index.js'
dotenv.config()
const avito = new avitoApi(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.USER_ID,
    // "fdfXigyiT5KtPSgeluAIagq4DnFAmYd8OOgfrg6B"
)
avito.start()
