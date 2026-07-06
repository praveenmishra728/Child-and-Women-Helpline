const contactService = require('../services/contact.service');
const ApiResponse = require('../utils/apiResponse');

const submitContactMessage = async (req, res, next) => {
  try {
    const result = await contactService.createMessage(req.body);
    return ApiResponse.created(res, 'Contact message submitted successfully.', result);
  } catch (error) {
    next(error);
  }
};

const listContactMessages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await contactService.getMessages(page, limit);
    return ApiResponse.success(res, 'Contact messages retrieved.', result);
  } catch (error) {
    next(error);
  }
};

const replyContactMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    const result = await contactService.replyMessage(id, reply);
    return ApiResponse.success(res, 'Reply updated successfully.', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitContactMessage,
  listContactMessages,
  replyContactMessage
};
