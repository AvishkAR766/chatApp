// Message storage functions
const STORAGE_KEY = 'chatMessages';

const saveMessageToStorage = (message) => {
    const messages = getMessagesFromStorage();
    messages.push(message);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
};

const getMessagesFromStorage = () => {
    const messages = localStorage.getItem(STORAGE_KEY);
    return messages ? JSON.parse(messages) : [];
};

const clearMessageStorage = () => {
    localStorage.removeItem(STORAGE_KEY);
};

// Load messages when page loads
const loadStoredMessages = () => {
    const messages = getMessagesFromStorage();
    messages.forEach(msg => {
        append(msg.content, msg.position);
    });
};

let userName;
while (!userName || userName.trim() === '') {
    userName = prompt('Enter your name to join');
    if (!userName || userName.trim() === '') {
        alert('Please enter a valid name!');
    }
}

const socket = io('http://localhost:8000');

// DOM elements
const sendContainer = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector('.container');
const fileInput = document.querySelector('.file-input');
const attachButton = document.querySelector('.attach-button');
const clearChatBtn = document.getElementById('clearChat');

// Initialize audio
let audio;
try {
    audio = new Audio('messageSound.mp3');
} catch (error) {
    console.log('Audio initialization failed:', error);
    audio = { play: () => {} };
}

// Load stored messages when page loads
document.addEventListener('DOMContentLoaded', loadStoredMessages);

// Clear chat functionality
clearChatBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
        clearMessageStorage();
        messageContainer.innerHTML = '';
    }
});

// Create typing indicator
const typingIndicator = document.createElement('div');
typingIndicator.className = 'typing-indicator';

// Typing timer
let typingTimeout = null;

// File handling
attachButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.match(/image.*/)) {
        alert('Please upload an image file');
        fileInput.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('File size should be less than 5MB');
        fileInput.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        attachButton.disabled = true;
        
        const response = await fetch('http://localhost:8000/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const data = await response.json();

        if (data.success) {
            const imageMessage = {
                type: 'image',
                url: data.url
            };
            
            append(imageMessage, 'right');
            socket.emit('send', imageMessage);
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert(error.message || 'Upload failed');
    } finally {
        fileInput.value = '';
        attachButton.disabled = false;
    }
});

// Message append function
const append = (data, position) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(position);

    if (typeof data === 'object' && data.type === 'image') {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';
        
        const img = document.createElement('img');
        img.src = data.url;
        img.alt = 'Shared image';
        img.className = 'shared-image';
        
        img.onload = () => imgContainer.classList.add('loaded');
        
        imgContainer.appendChild(img);
        messageElement.appendChild(imgContainer);

        // Save image message
        if (position !== 'system') {
            saveMessageToStorage({
                content: { type: 'image', url: data.url },
                position: position,
                timestamp: new Date().getTime()
            });
        }
    } else if (position === 'system') {
        messageElement.innerText = data;
        // Save system message
        saveMessageToStorage({
            content: data,
            position: position,
            timestamp: new Date().getTime()
        });
    } else {
        messageElement.innerText = position === 'right' ? 
            `You: ${data}` : 
            typeof data === 'string' ? data : `${data.name}: ${data.message}`;
        
        // Save text message
        if (position !== 'system') {
            saveMessageToStorage({
                content: typeof data === 'string' ? data : `${data.name}: ${data.message}`,
                position: position,
                timestamp: new Date().getTime()
            });
        }
    }

    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
};

// Socket event listeners
socket.emit('new-user-joined', userName.trim());

socket.on('user-joined', name => {
    append(`${name} joined the chat`, 'system');
});

socket.on('receive', data => {
    if (data.type === 'image') {
        append(data, 'left');
    } else {
        append(data, 'left');
    }
    audio.play();
});

socket.on('left', name => {
    append(`${name} left the chat`, 'system');
});

// Typing indicator handlers
messageInput.addEventListener('input', () => {
    socket.emit('typing');
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    typingTimeout = setTimeout(() => {
        socket.emit('stop-typing');
    }, 1000);
});

socket.on('typing', name => {
    typingIndicator.innerText = `${name} is typing...`;
    if (!messageContainer.contains(typingIndicator)) {
        messageContainer.appendChild(typingIndicator);
    }
    messageContainer.scrollTop = messageContainer.scrollHeight;
});

socket.on('stop-typing', () => {
    if (messageContainer.contains(typingIndicator)) {
        messageContainer.removeChild(typingIndicator);
    }
});

// Form submission
sendContainer.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    if (message) {
        append(message, 'right');
        socket.emit('send', { message });
        messageInput.value = '';
        
        if (typingTimeout) {
            clearTimeout(typingTimeout);
            socket.emit('stop-typing');
        }
    }
});
