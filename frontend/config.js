// Automatically detect if running locally or in production
const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

const API_URL = isLocal 
    ? "http://127.0.0.1:5000/api" 
    : "https://library-management-system-k8l4.onrender.com/api";