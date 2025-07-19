"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const TelegramBot_1 = require("./bot/TelegramBot");
// Load environment variables
dotenv_1.default.config();
async function main() {
    try {
        const bot = new TelegramBot_1.SimpleTelegramBot();
        await bot.start();
    }
    catch (error) {
        console.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}
// Start the bot
if (require.main === module) {
    main();
}
exports.default = TelegramBot_1.SimpleTelegramBot;
