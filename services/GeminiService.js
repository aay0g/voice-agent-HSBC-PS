const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.useFallback = !this.apiKey;
    
    if (this.useFallback) {
      console.log('⚠️  No GEMINI_API_KEY found, using fallback responses');
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
    
    this.chat = null;
    this.conversationHistory = [];
  }

  async initializeChat() {
    if (this.useFallback) {
      return null;
    }
    
    try {
      this.chat = this.model.startChat({
        history: this.conversationHistory,
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.5,
        },
      });
      return this.chat;
    } catch (error) {
      console.error('Error initializing Gemini chat:', error);
      throw error;
    }
  }

  async generateResponse(message, isVoice = false) {
    if (this.useFallback) {
      return this.getFallbackResponse(message);
    }
    
    try {
      if (!this.chat) {
        await this.initializeChat();
      }

      let prompt = message;
      if (isVoice) {
        prompt = `You are a helpful voice assistant. Respond naturally and conversationally. Keep responses concise for voice interaction. User: ${message}`;
      }

      const result = await this.chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      this.conversationHistory.push({
        role: "user",
        parts: [{ text: message }]
      });
      this.conversationHistory.push({
        role: "model",
        parts: [{ text }]
      });

      return text;
    } catch (error) {
      console.error('Error generating response:', error);
      
      return this.getFallbackResponse(message);
    }
  }

  async generateStreamingResponse(message, onChunk) {
    if (this.useFallback) {
      const response = this.getFallbackResponse(message);
      if (onChunk) {
        onChunk(response);
      }
      return response;
    }
    
    try {
      if (!this.chat) {
        await this.initializeChat();
      }

      const prompt = `You are a helpful voice assistant. Respond naturally and conversationally. Keep responses concise for voice interaction. User: ${message}`;
      
      const result = await this.chat.sendMessageStream(prompt);
      
      let fullResponse = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        if (onChunk) {
          onChunk(chunkText);
        }
      }

      this.conversationHistory.push({
        role: "user",
        parts: [{ text: message }]
      });
      this.conversationHistory.push({
        role: "model",
        parts: [{ text: fullResponse }]
      });

      return fullResponse;
    } catch (error) {
      console.error('Error generating streaming response:', error);
      
      const fallbackResponse = this.getFallbackResponse(message);
      
      if (onChunk) {
        onChunk(fallbackResponse);
      }
      
      return fallbackResponse;
    }
  }

  getFallbackResponse(message) {
    const responses = [
      `I heard you say: "${message}". I'm here to help you with any questions or tasks you might have.`,
      `You mentioned: "${message}". How can I assist you today?`,
      `I understand you said: "${message}". I'm ready to help you with whatever you need.`,
      `Thanks for sharing: "${message}". What would you like to know or do?`,
      `I caught that: "${message}". Let me know how I can be of service to you.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  resetConversation() {
    this.conversationHistory = [];
    this.chat = null;
  }

  getConversationHistory() {
    return this.conversationHistory;
  }
}

module.exports = GeminiService; 