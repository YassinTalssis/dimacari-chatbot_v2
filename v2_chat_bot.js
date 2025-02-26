import React, { useState, useEffect, useRef } from "react";
import ollama from "ollama/browser";
import "./App.css";
import carsData from "./data.json";
import { Mic, Send, Trash, Sun, Moon } from "lucide-react";

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState("llama3.2");
  const [selectedCar, setSelectedCar] = useState(null);
  const chatWindowRef = useRef(null);
  const recognitionRef = useRef(null);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        setInput(event.results[0][0].transcript);
      };

      recognitionRef.current.onend = () => setRecording(false);
      recognitionRef.current.onerror = () => setRecording(false);
    }
  }, []);

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  // Toggle Voice Recording
  const toggleRecording = () => {
    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
    } else {
      recognitionRef.current.start();
      setRecording(true);
    }
  };

  // Chat Auto-scroll
  useEffect(() => {
    chatWindowRef.current?.scrollTo(0, chatWindowRef.current.scrollHeight);
  }, [messages]);

  // Extract context from user history
  const extractContext = () => {
    const context = { model: null, brand: null, city: null };

    // Loop through user messages to extract preferences
    messages.forEach((msg) => {
      if (msg.type === "user") {
        const lowerText = msg.content.toLowerCase();

        // Extract model
        const modelMatch = lowerText.match(/model\s+(\w+)/i);
        if (modelMatch) context.model = modelMatch[1];

        // Extract brand
        const brandMatch = lowerText.match(/(toyota|honda|nissan|hyundai|dacia|renault)/i);
        if (brandMatch) context.brand = brandMatch[1];

        // Extract city
        const cityMatch = lowerText.match(/in\s+(\w+)/i);
        if (cityMatch) context.city = cityMatch[1];
      }
    });

    return context;
  };

  // Filter cars based on query and context
  const filterCars = (query, context) => {
    const lowerQuery = query.toLowerCase();
    let results = carsData;

    // Apply context filters
    if (context.model) {
      results = results.filter((car) =>
        car.model.toLowerCase().includes(context.model.toLowerCase())
      );
    }
    if (context.brand) {
      results = results.filter((car) =>
        car.brand.toLowerCase().includes(context.brand.toLowerCase())
      );
    }
    if (context.city) {
      results = results.filter((car) =>
        car.city.toLowerCase().includes(context.city.toLowerCase())
      );
    }

    return results.slice(0, 4); // Limit to 4 results
  };

  // Message Handling
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { type: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const isCarQuery = /car|rent|vehicle|model|price|dhs/i.test(input.toLowerCase());
      const isImageRequest = /show\s+me\s+(images?|pictures?)/i.test(input.toLowerCase());
      const context = extractContext(); // Extract context from user history
      const carResults = isCarQuery ? filterCars(input, context) : [];

      // Generate AI response
      const prompt = `You are a helpful car rental assistant for DimaCari. Respond to the user's query based on the following context:
      
      **User Query:**
      ${input}

      **Context:**
      - Model: ${context.model || "Not specified"}
      - Brand: ${context.brand || "Not specified"}
      - City: ${context.city || "Not specified"}

      **Instructions:**
      1. Respond naturally in user language that used to ask you and maintain context from the conversation history.
      2. If the query is car-related, mention available options without listing details.
      3. If the user asks to see images, respond with a message indicating that images will be shown.
      4. Avoid markdown, links, and images in text responses.
      5. Keep responses concise and relevant to DimaCari.`;

      const response = await ollama.chat({
        model: selectedModel,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      });

      let aiResponse = "";
      for await (const chunk of response) {
        aiResponse += chunk.message?.content || "";
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.type === "ai"
            ? [...prev.slice(0, -1), { type: "ai", content: aiResponse }]
            : [...prev, { type: "ai", content: aiResponse }];
        });
      }

      // Add car results if relevant
      if (isCarQuery && carResults.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            type: "system",
            content: isImageRequest ? "Here are the available cars with images:" : "Available vehicles:",
            cars: carResults,
          },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          content: "Sorry, I'm having trouble responding. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function for text-to-speech
  const speakText = (text) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className={`app ${darkMode ? "dark-mode" : ""}`}>
      <header>
        <h1>AutoChat</h1>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="model-select"
        >
          <option value="llama3.2">Llama 3</option>
          <option value="deepseek-r1">DeepSeek</option>
          <option value="codellama">CodeLlama</option>
        </select>
      </header>

      <div className="chat-window" ref={chatWindowRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            {msg.type === "system" ? (
              <div className="car-results">
                <p>{msg.content}</p>
                <div className="car-grid">
                  {msg.cars.map((car) => (
                    <div key={car.id} className="car-card">
                      <div className="car-media">
                        {car.images?.map((img, i) => (
                          <img key={i} src={img} alt={`${car.model} ${i + 1}`} />
                        ))}
                      </div>
                      <div className="car-details">
                        <h3>{car.model}</h3>
                        <div className="price-badge">
                          {car.price} DHS<span>/day</span>
                        </div>
                        <div className="location">
                          <span>📍</span>{car.city}
                        </div>
                        <button
                          className="details-btn"
                          onClick={() => setSelectedCar(car)}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="message-content">
                {msg.content}
                {msg.type === "ai" && (
                  <button
                    className="speak-btn"
                    onClick={() => speakText(msg.content)}
                  >
                    🔊
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedCar && (
        <div className="car-modal">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setSelectedCar(null)}>
              &times;
            </button>
            <h2>{selectedCar.model}</h2>
            <div className="gallery">
              {selectedCar.images.map((img, i) => (
                <img key={i} src={img} alt={`${selectedCar.model} view ${i + 1}`} />
              ))}
            </div>
            <div className="specs">
              <p>
                <strong>Price:</strong> {selectedCar.price} DHS/day
              </p>
              <p>
                <strong>Location:</strong> {selectedCar.city}
              </p>
              {selectedCar.features && (
                <p>
                  <strong>Features:</strong> {selectedCar.features.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t flex flex-col bg-gray-100 dark:bg-gray-800">
        <div className="flex items-center bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden">
          <input
            type="text"
            className="flex-1 px-4 py-2 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
            placeholder="Type or speak your message..."
            disabled={loading}
          />
          <button
            className={`p-2 ${recording ? "text-red-500" : "text-gray-500"}`}
            onClick={toggleRecording}
            disabled={!recognitionRef.current}
          >
            <Mic size={20} />
          </button>
        </div>
        <div className="mt-3 flex justify-between">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition disabled:opacity-50"
            onClick={sendMessage}
            disabled={loading}
          >
            <Send size={16} />
            {loading ? "Sending..." : "Send"}
          </button>
          <button
            className="p-2 text-gray-500 hover:text-red-500 transition"
            onClick={() => setMessages([])}
          >
            <Trash size={20} />
          </button>
          <button
            className="p-2 text-gray-500 hover:text-yellow-500 transition"
            onClick={toggleDarkMode}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
