import axios from 'axios';
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import qs from 'qs';
import keypress from 'keypress';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import { exit } from 'process';
dotenv.config()

export default class avitoApi {

    #accessToken = null;
    #buffer = "";
    #timers = {
        loopAnswer: null,
        loopAuth: null
    };
    #items = [];
    #commands = [
        "getChats"
    ];

    constructor(clientId, clientSecret, userId, accessToken = null) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.userId = userId

        if (accessToken != null) {
            this.#accessToken = accessToken
        }
    }

    get accessToken() {
        return this.#accessToken;
    }

    commandLine() {
        keypress(process.stdin)
        process.stdin.on('keypress', (ch, key) => {

            //console.log('got "keypress"', key);
            const command = "stop";

            if (key && key.name == 'backspace') {
                process.stdout.clearLine();
                process.stdout.cursorTo(-1);
                this.#buffer = this.#buffer.substring(0, this.#buffer.length - 1);
                process.stdout.write(this.#buffer);
            }
            else if (key && key.name != 'return') {
                this.#buffer = this.#buffer + key.name;
                process.stdout.write(key.name);
            }
            else if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'return') {
                if (this.#buffer == command) {
                    process.exit();
                }
                this.#buffer = ""
                process.stdout.write("\n");
            }

            if (key && key.ctrl && key.name == 'c') {
                process.exit()
            }
        });
        process.stdin.setRawMode(true);
        process.stdin.resume();
    }

    async #loopAuth() {
        if (this.#accessToken == null) {
            await this.#getToken();
        }

        const timer = setInterval(this.#refreshToken, 60000 * 60 * 20);
        this.#timers.loopAuth = timer

        console.log("Запущено обновление токенов")
    }

    async loopChat() {

    }

    async start() {
        this.commandLine();
        this.#loopAuth();
        this.#chatLoopAnswer();
    }

    async #chatLoopAnswer() {
        const timer = setInterval(async () => {
            console.log("Запуск проверки сообщений");
            await this.#readItems();
            const chats = await this.#getChats();
            const chatResponses = await this.#formatChatResponse(chats);
            this.#sendMessageToChats(chatResponses);
            console.log("Проверка сообщений завершена");
        }, 30000)
        this.#timers.loopAnswer = timer
    }

    async #sendMessageToChats(chatResponses) {
        chatResponses.forEach(chat => {
            this.#readChat(chat.chat_id).then(() => {
                console.log("Прочитал");
            });
            this.#sendMessage(chat.chat_id, chat.message).then((response) => {
                console.log(response.data, response.status);
                console.log('Отправлено: ' + chat.message);
            })
        });
    }

    #sendMessage(chat_id, message) {
        const json = JSON.stringify({
            "message": {
                "text": message
            },
            "type": "text"
        })
        return axios.post('https://api.avito.ru/messenger/v1/accounts/' + this.userId + '/chats/' + chat_id + '/messages', json, {
            headers: {
                Authorization: "Bearer " + this.#accessToken
            },
        }).catch((error) => this.#errorHandler(error, 'Не удалось отправить сообщение'))
    }

    #readChat(chat_id) {
        const options = {
            method: 'POST',
            headers: {
                Authorization: "Bearer " + this.#accessToken
            },
            url: 'https://api.avito.ru/messenger/v1/accounts/' + this.userId + '/chats/' + chat_id + '/read',
        };

        return axios(options).catch((error) => this.#errorHandler(error, 'Не удалось прочитать чат'))
    }

    #formatChatResponse(chats = []) {
        let chatResponses = [];
        chats.forEach((chat) => {
            const filter = this.#items.find((item) => {
                return item.id == chat.context.value.id
            });
            const chatResponse = {
                "chat_id": chat.id,
                "item_id": filter.id,
                "message": filter.message
            }
            chatResponses.push(chatResponse);
        })
        return chatResponses;
    }

    #getChats() {
        const options = {
            method: 'GET',
            headers: {
                Authorization: "Bearer " + this.#accessToken
            },
            //url: 'https://api.avito.ru/messenger/v2/accounts/' + this.userId + '/chats?per_page=100&item_ids=' + this.#stringifyItemIds(),
            url: 'https://api.avito.ru/messenger/v2/accounts/' + this.userId + '/chats?unread_only=true&per_page=100&item_ids=' + this.#stringifyItemIds(),
        };

        return axios(options).then((response) => {
            return response.data.chats;
        })
    }

    #readItems() {
        const parser = new XMLParser
        const xmlFile = fs.readFileSync('items.xml');
        const items = parser.parse(xmlFile).item
        if (Array.isArray(items)) {
            this.#items = items;
        }
        else {
            this.#items = [items];
        }
    }

    #stringifyItemIds() {
        let ids = [];
        this.#items.forEach((value) => {
            ids.push(value.id);
        })
        return ids.join(',');
    }

    #errorHandler(error, message = 'Error') {
        throw new Error(message + ': ' + error.response.data.result.message)
    }

    #getToken() {
        const data = {
            "client_id": this.clientId,
            "client_secret": this.clientSecret,
            "grant_type": "client_credentials",
        }

        const options = {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            data: qs.stringify(data),
            url: 'https://api.avito.ru/token',
        };

        return axios(options).then((response) => {
            this.#accessToken = response.data.access_token
        }).catch((error) => this.#errorHandler(error, 'Не удалось получить токен'))
    }

    #refreshToken(token) {
        const data = {
            "client_id": this.client_id,
            "client_secret": this.client_secret,
            "grant_type": "refresh_token",
            "refresh_token": token
        }

        const options = {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            data: qs.stringify(data),
            url: 'https://api.avito.ru/token',
        };

        return axios(options).then((response) => {
            this.#accessToken = response.data.access_token
        }).catch((error) => this.#errorHandler(error, 'Не удалось обновить токен'))
    }
}