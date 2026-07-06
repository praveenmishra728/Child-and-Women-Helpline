const supabase = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const mockMessages = [
  {
    id: 'm1234567-1234-1234-1234-1234567890ab',
    name: 'Priya Sharma',
    email: 'priya.sharma@gmail.com',
    subject: 'Question About My Report',
    message: 'I filed a report yesterday but want to know if I can attach additional documents now.',
    reply: 'Hello Priya, you can update your draft reports anytime, or add details via the comments/feedback when under review.',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString() // 1 day ago
  },
  {
    id: 'm2345678-2342-2342-2342-2342567890bc',
    name: 'Rahul Kumar',
    email: 'rahul.kumar@gmail.com',
    subject: 'Feedback & Suggestions',
    message: 'The AI Safety Assistant is extremely helpful! Thanks for building this platform.',
    reply: null,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  }
];

const createMessage = async (data) => {
  const msgRecord = {
    id: uuidv4(),
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
    reply: null,
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data: inserted, error } = await supabase
        .from('contact_messages')
        .insert(msgRecord)
        .select('*')
        .single();
      
      if (!error && inserted) {
        return inserted;
      }
      console.warn('[Contact Service] Database insert failed or table missing, falling back to mock storage. Error:', error?.message);
    } catch (err) {
      console.warn('[Contact Service] Database insert error, falling back to mock storage. Error:', err.message);
    }
  }

  // Fallback to memory
  mockMessages.push(msgRecord);
  return msgRecord;
};

const getMessages = async (page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  if (supabase) {
    try {
      const { data, count, error } = await supabase
        .from('contact_messages')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(startIndex, startIndex + limit - 1);
      
      if (!error) {
        return {
          list: data || [],
          total: count || 0
        };
      }
      console.warn('[Contact Service] Database fetch failed, falling back to mock storage. Error:', error.message);
    } catch (err) {
      console.warn('[Contact Service] Database fetch error, falling back to mock storage. Error:', err.message);
    }
  }

  // Fallback to memory
  const sorted = [...mockMessages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return {
    list: sorted.slice(startIndex, endIndex),
    total: sorted.length
  };
};

const replyMessage = async (id, replyText) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .update({ reply: replyText })
        .eq('id', id)
        .select('*')
        .single();
      
      if (!error && data) {
        return data;
      }
      console.warn('[Contact Service] Database reply update failed, falling back to mock storage. Error:', error?.message);
    } catch (err) {
      console.warn('[Contact Service] Database reply update error, falling back to mock storage. Error:', err.message);
    }
  }

  // Fallback to memory
  const msg = mockMessages.find(m => m.id === id);
  if (!msg) {
    throw new Error('Message not found.');
  }
  msg.reply = replyText;
  return msg;
};

module.exports = {
  createMessage,
  getMessages,
  replyMessage
};
