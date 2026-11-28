import { handleChatMessage } from '../services/chatbotService.js';
import { ok, fail } from '../utils/response.js';

export const chat = async (req, res, next) => {
    try {
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        const lang = req.body?.lang === 'ta' ? 'ta' : 'en';
        if (!message) {
            return fail(res, 400, 'Please enter a message');
        }
        const result = await handleChatMessage(message, lang);
        return ok(res, result);
    } catch (error) {
        next(error);
    }
};
