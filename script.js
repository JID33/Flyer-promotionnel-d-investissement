// Firebase SDKs imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, updateDoc, deleteDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Global variables for Firebase instances
let app;
let db;
let auth;
let storage; // Firebase Storage instance
let currentUserId = 'Chargement...'; // Default loading state for user ID
let currentDisplayName = 'Inconnu'; // User's display name
let currentChatMode = 'public'; // 'public', 'private', 'group'
let currentChatId = null; // Used for private recipient ID or group ID
let unsubscribeMessageSnapshot = null; // To store the unsubscribe function for the Firestore message listener
let unsubscribeTypingSnapshot = null; // To store the unsubscribe function for the Firestore typing listener
let unsubscribeGroupMembersSnapshot = null; // To store the unsubscribe for group members
let selectedFile = null; // To store the file selected for attachment
let typingTimeout = null; // Timeout for setting typing status to false
const userDisplayNames = {}; // Cache for user display names (UID -> Display Name)

// Get DOM elements
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const currentUserIdSpan = document.getElementById('currentUserId');
const myDisplayNameSpan = document.getElementById('myDisplayName');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorMessageDiv = document.getElementById('errorMessage');

const publicChatBtn = document.getElementById('publicChatBtn');
const privateChatBtn = document.getElementById('privateChatBtn');
const groupChatBtn = document.getElementById('groupChatBtn');
const privateRecipientInputDiv = document.getElementById('privateRecipientInput');
const privateRecipientIdInput = document.getElementById('privateRecipientId');
const groupNameInputDiv = document.getElementById('groupNameInput');
const groupChatIdInput = document.getElementById('groupChatId');
const currentChatDisplay = document.getElementById('currentChatDisplay');

const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');

const emojiButton = document.getElementById('emojiButton');
const emojiPicker = document.getElementById('emojiPicker');
const typingIndicatorArea = document.getElementById('typingIndicatorArea');

const profileModal = document.getElementById('profileModal');
const modalUserIdDisplay = document.getElementById('modalUserIdDisplay');
const displayNameInput = document.getElementById('displayNameInput');
const saveDisplayNameBtn = document.getElementById('saveDisplayNameBtn');

const groupManagementArea = document.getElementById('groupManagementArea');
const addMemberInput = document.getElementById('addMemberInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const groupMembersList = document.getElementById('groupMembersList');


// List of common emojis for the picker
const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '�', '😗', '😙', '😚',
    '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤨',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
    '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
    '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟',
    '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😩',
    '😫', '😤', '😠', '😡', '🤬', '😈', '👿', '💀', '☠️', '💩',
    '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '🎃', '😺', '😸',
    '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐️',
    '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈',
    '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
    '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳',
    '💪', '🦾', '🦵', '🦶', '👂', '👃', '🧠', '🫀', '🫁', '🦷',
    '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸', '🦠', '🩻', '💖',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💘', '💝', '🧡', '💛', '💚',
    '💙', '💜', '🤎', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓',
    '💗', '💘', '💝', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️',
    '💣', '💬', '👁️‍🗨️', '🗨️', '💭', '🗯️', '♠️', '♥️', '♦️', '♣️'
];

// Function to display error messages
function displayError(message) {
    errorMessageDiv.textContent = `Erreur: ${message}`;
    errorMessageDiv.style.display = 'block';
    console.error(message);
}

// Function to request notification permission
async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("Ce navigateur ne supporte pas les notifications de bureau.");
        return;
    }
    if (Notification.permission === "granted") {
        console.log("Permission de notification déjà accordée.");
        return;
    }
    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            console.log("Permission de notification accordée.");
        } else {
            console.warn("Permission de notification refusée.");
        }
    }
}

// Function to get a user's display name, caching it
async function getDisplayName(uid) {
    if (userDisplayNames[uid]) {
        return userDisplayNames[uid];
    }
    if (!db) return `Utilisateur ${uid.substring(0, 6)}...`;

    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const displayName = userDocSnap.data().displayName;
            userDisplayNames[uid] = displayName;
            return displayName;
        } else {
            return `Utilisateur ${uid.substring(0, 6)}...`;
        }
    } catch (error) {
        console.error("Erreur lors de la récupération du nom d'affichage:", error);
        return `Utilisateur ${uid.substring(0, 6)}...`;
    }
}

// Function to set up or update user profile
async function setupUserProfile(uid) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, uid);
    try {
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists() || !userDocSnap.data().displayName) {
            // Show modal to set display name if not set
            modalUserIdDisplay.textContent = uid;
            profileModal.classList.remove('hidden');
            displayNameInput.focus();
        } else {
            currentDisplayName = userDocSnap.data().displayName;
            myDisplayNameSpan.textContent = currentDisplayName;
            userDisplayNames[uid] = currentDisplayName; // Cache my own display name
            profileModal.classList.add('hidden'); // Hide if already set
        }
    } catch (error) {
        displayError(`Erreur lors de la récupération du profil utilisateur: ${error.message}`);
    }
}

// Save display name from modal
saveDisplayNameBtn.addEventListener('click', async () => {
    const newDisplayName = displayNameInput.value.trim();
    if (newDisplayName.length < 2) {
        displayError("Le nom d'affichage doit contenir au moins 2 caractères.");
        return;
    }
    if (!db || !currentUserId) {
        displayError("Impossible d'enregistrer le nom d'affichage: base de données ou utilisateur non prêt.");
        return;
    }

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, currentUserId);
    try {
        await setDoc(userDocRef, { displayName: newDisplayName, uid: currentUserId }, { merge: true });
        currentDisplayName = newDisplayName;
        myDisplayNameSpan.textContent = currentDisplayName;
        userDisplayNames[currentUserId] = currentDisplayName; // Cache my own display name
        profileModal.classList.add('hidden');
    } catch (error) {
        displayError(`Erreur lors de l'enregistrement du nom d'affichage: ${error.message}`);
    }
});

// Initialize Firebase and setup listeners when the window loads
window.onload = async () => {
    try {
        // --- DÉBOGAGE DES VARIABLES D'ENVIRONNEMENT ---
        console.log("Raw __firebase_config:", typeof __firebase_config !== 'undefined' ? __firebase_config : "undefined ou non disponible");
        console.log("Raw __app_id:", typeof __app_id !== 'undefined' ? __app_id : "undefined ou non disponible");
        console.log("Raw __initial_auth_token:", typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : "undefined ou non disponible");
        // --- FIN DU DÉBOGAGE ---

        // Mandatory Firebase configuration and app ID
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' && __firebase_config !== '' ? __firebase_config : '{}');
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        console.log("Parsed firebaseConfig:", firebaseConfig); // Log the parsed config

        if (Object.keys(firebaseConfig).length === 0) {
            displayError("Configuration Firebase manquante ou invalide. Assurez-vous que __firebase_config est correctement défini par l'environnement.");
            loadingOverlay.style.display = 'none';
            return;
        }

        // Initialize Firebase app
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app); // Initialize Firebase Storage

        // Authenticate user
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        // Request notification permission
        await requestNotificationPermission();

        // Listen for auth state changes to get the user ID
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                currentUserIdSpan.textContent = currentUserId;
                console.log("Utilisateur authentifié:", currentUserId);
                await setupUserProfile(currentUserId); // Setup user profile
                // Start listening for messages in public chat by default
                switchChat('public');
            } else {
                currentUserId = 'Non authentifié';
                currentUserIdSpan.textContent = currentUserId;
                myDisplayNameSpan.textContent = '';
                profileModal.classList.add('hidden'); // Hide modal if not authenticated
                console.log("Utilisateur non authentifié.");
            }
            loadingOverlay.style.display = 'none'; // Hide loading overlay once auth is done
        });

        // Populate emoji picker
        emojis.forEach(emoji => {
            const button = document.createElement('button');
            button.textContent = emoji;
            button.addEventListener('click', () => {
                messageInput.value += emoji;
                emojiPicker.style.display = 'none'; // Hide picker after selection
                messageInput.focus(); // Keep focus on input
            });
            emojiPicker.appendChild(button);
        });

    } catch (error) {
        // Capture and display any errors during the initial setup
        displayError(`Échec de l'initialisation de Firebase ou de l'authentification: ${error.message}. Vérifiez votre configuration Firebase.`);
        loadingOverlay.style.display = 'none';
    }
};

// Function to switch between chat modes (public, private, group)
function switchChat(mode, id = null) {
    // Detach previous listeners
    if (unsubscribeMessageSnapshot) {
        unsubscribeMessageSnapshot();
    }
    if (unsubscribeTypingSnapshot) {
        unsubscribeTypingSnapshot();
    }
    if (unsubscribeGroupMembersSnapshot) {
        unsubscribeGroupMembersSnapshot();
    }
    // Reset typing status for current user in previous chat
    setTypingStatus(false);

    currentChatMode = mode;
    currentChatId = id;
    messagesArea.innerHTML = ''; // Clear messages when switching chat
    typingIndicatorArea.innerHTML = ''; // Clear typing indicators
    selectedFile = null; // Clear selected file when switching chat
    fileNameDisplay.textContent = ''; // Clear file name display
    emojiPicker.style.display = 'none'; // Hide emoji picker
    groupManagementArea.style.display = 'none'; // Hide group management by default

    // Update UI for active button
    document.querySelectorAll('.chat-mode-button').forEach(btn => btn.classList.remove('active'));
    if (mode === 'public') {
        publicChatBtn.classList.add('active');
        privateRecipientInputDiv.classList.add('hidden');
        groupNameInputDiv.classList.add('hidden');
        currentChatDisplay.textContent = 'Chat Actuel: Public';
        setupMessageListener(getPublicMessagesCollectionRef(), 'public_chat_id');
    } else if (mode === 'private') {
        privateChatBtn.classList.add('active');
        privateRecipientInputDiv.classList.remove('hidden');
        groupNameInputDiv.classList.add('hidden');
        currentChatDisplay.textContent = `Chat Actuel: Privé avec ${id ? id.substring(0, 6) + '...' : '...'}`;
        // Listener will be set up when recipient ID is entered
        if (id) {
            const chatUsers = [currentUserId, id].sort();
            const privateChatId = chatUsers[0] + '_' + chatUsers[1];
            setupMessageListener(getPrivateMessagesCollectionRef(currentUserId, id), privateChatId);
        }
    } else if (mode === 'group') {
        groupChatBtn.classList.add('active');
        privateRecipientInputDiv.classList.add('hidden');
        groupNameInputDiv.classList.remove('hidden');
        groupManagementArea.style.display = 'flex'; // Show group management
        currentChatDisplay.textContent = `Chat Actuel: Groupe ${id ? id : '...'}`;
        // Listener will be set up when group ID is entered
        if (id) {
            setupMessageListener(getGroupMessagesCollectionRef(id), id);
            setupGroupMembersListener(id); // Listen for group members
        }
    }
}

// Helper functions to get collection references based on chat mode
function getPublicMessagesCollectionRef() {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return collection(db, `artifacts/${appId}/public/data/messages`);
}

function getPrivateMessagesCollectionRef(user1Id, user2Id) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    // Ensure consistent chat ID for private chats (sorted user IDs)
    const chatUsers = [user1Id, user2Id].sort();
    const chatId = chatUsers[0] + '_' + chatUsers[1];
    return collection(db, `artifacts/${appId}/public/data/private_chats/${chatId}/messages`);
}

function getGroupMessagesCollectionRef(groupId) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return collection(db, `artifacts/${appId}/public/data/groups/${groupId}/messages`);
}

function getGroupDocRef(groupId) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return doc(db, `artifacts/${appId}/public/data/groups`, groupId);
}

// Function to get typing status collection reference for the current chat
function getTypingStatusCollectionRef(chatId) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    let path;
    if (currentChatMode === 'public') {
        path = `artifacts/${appId}/public/data/messages/public_chat_id/typing_status`;
    } else if (currentChatMode === 'private') {
        const chatUsers = [currentUserId, currentChatId].sort();
        const privateChatId = chatUsers[0] + '_' + chatUsers[1];
        path = `artifacts/${appId}/public/data/private_chats/${privateChatId}/typing_status`;
    } else if (currentChatMode === 'group') {
        path = `artifacts/${appId}/public/data/groups/${currentChatId}/typing_status`;
    }
    return collection(db, path);
}

// Function to update typing status in Firestore
async function setTypingStatus(isTyping) {
    if (!db || !auth.currentUser || (!currentChatId && currentChatMode !== 'public')) {
        return; // Cannot set typing status if not authenticated or chat not defined
    }
    const actualChatIdForTyping = currentChatMode === 'public' ? 'public_chat_id' : (currentChatMode === 'private' ? [currentUserId, currentChatId].sort().join('_') : currentChatId);
    const typingStatusRef = doc(getTypingStatusCollectionRef(actualChatIdForTyping), currentUserId);
    try {
        if (isTyping) {
            await setDoc(typingStatusRef, { isTyping: true, timestamp: serverTimestamp() });
        } else {
            // Delete the document when not typing to keep the collection clean
            await deleteDoc(typingStatusRef);
        }
    } catch (error) {
        console.error("Erreur lors de la mise à jour du statut de saisie:", error);
    }
}

// Function to send a message
async function sendMessage() {
    const messageText = messageInput.value.trim();

    if (messageText === "" && !selectedFile) {
        return; // Don't send empty messages or no file
    }

    if (!db || !auth.currentUser || !storage) {
        displayError("Base de données, utilisateur non authentifié ou stockage non initialisé. Impossible d'envoyer le message.");
        return;
    }

    let targetCollectionRef;
    let chatIdentifier = ''; // For display purposes
    let fileData = null; // To store file URL, name, type
    let actualChatIdForTyping = '';

    try {
        if (currentChatMode === 'public') {
            targetCollectionRef = getPublicMessagesCollectionRef();
            chatIdentifier = 'Public';
            actualChatIdForTyping = 'public_chat_id';
        } else if (currentChatMode === 'private') {
            const recipientId = privateRecipientIdInput.value.trim();
            if (!recipientId || recipientId === currentUserId) {
                displayError("Veuillez entrer un ID de destinataire valide pour le chat privé (différent de votre propre ID).");
                return;
            }
            currentChatId = recipientId; // Update currentChatId for private
            targetCollectionRef = getPrivateMessagesCollectionRef(currentUserId, recipientId);
            chatIdentifier = `Privé avec ${recipientId.substring(0, 6)}...`;
            const chatUsers = [currentUserId, recipientId].sort();
            actualChatIdForTyping = chatUsers[0] + '_' + chatUsers[1];
        } else if (currentChatMode === 'group') {
            const groupId = groupChatIdInput.value.trim();
            if (!groupId) {
                displayError("Veuillez entrer un ID de groupe valide pour le chat de groupe.");
                return;
            }
            currentChatId = groupId; // Update currentChatId for group
            targetCollectionRef = getGroupMessagesCollectionRef(groupId);
            chatIdentifier = `Groupe ${groupId}`;
            actualChatIdForTyping = groupId;

            // Create group document if it doesn't exist and add current user as member
            const groupDocRef = getGroupDocRef(groupId);
            const groupDocSnap = await getDoc(groupDocRef);
            if (!groupDocSnap.exists()) {
                 await setDoc(groupDocRef, {
                    name: groupId, // Or a more descriptive name
                    createdAt: serverTimestamp(),
                    members: [currentUserId]
                });
            } else {
                // Ensure current user is a member
                const members = groupDocSnap.data().members || [];
                if (!members.includes(currentUserId)) {
                    await updateDoc(groupDocRef, {
                        members: arrayUnion(currentUserId)
                    });
                }
            }
        } else {
            displayError("Mode de chat inconnu.");
            return;
        }

        // Handle file upload if a file is selected
        if (selectedFile) {
            loadingOverlay.style.display = 'flex'; // Show loading spinner
            const storagePath = `attachments/${currentChatMode}/${actualChatIdForTyping}/${auth.currentUser.uid}/${Date.now()}_${selectedFile.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadResult = await uploadBytes(storageRef, selectedFile);
            const fileUrl = await getDownloadURL(uploadResult.ref);
            fileData = {
                url: fileUrl,
                name: selectedFile.name,
                type: selectedFile.type
            };
            loadingOverlay.style.display = 'none'; // Hide loading spinner
        }

        await addDoc(targetCollectionRef, {
            text: messageText,
            senderId: auth.currentUser.uid,
            timestamp: serverTimestamp(), // Use server timestamp for consistency
            file: fileData // Add file data if available
        });

        messageInput.value = ''; // Clear input field
        selectedFile = null; // Clear selected file
        fileNameDisplay.textContent = ''; // Clear file name display
        fileInput.value = ''; // Clear file input

        // Set typing status to false after sending a message
        setTypingStatus(false);
        clearTimeout(typingTimeout); // Clear any pending typing timeout

        // Ensure listener is active for the current chat after sending
        if (currentChatMode === 'private' && currentChatId) {
            switchChat('private', currentChatId);
        } else if (currentChatMode === 'group' && currentChatId) {
            switchChat('group', currentChatId);
        }
        messagesArea.scrollTop = messagesArea.scrollHeight; // Scroll to bottom
        currentChatDisplay.textContent = `Chat Actuel: ${chatIdentifier}`; // Update display
    } catch (error) {
        displayError(`Erreur lors de l'envoi du message: ${error.message}`);
        loadingOverlay.style.display = 'none'; // Hide loading spinner on error
    }
}

// Function to set up real-time message listener
function setupMessageListener(messageCollectionRef, chatIdForTyping) {
    if (!db) {
        displayError("Base de données non initialisée pour l'écoute des messages.");
        return;
    }
    try {
        // Query messages, ordering by timestamp.
        const q = query(messageCollectionRef, orderBy('timestamp', 'asc'));

        unsubscribeMessageSnapshot = onSnapshot(q, async (snapshot) => {
            // Clear all messages and re-render to ensure correct order after initial load/re-render
            messagesArea.innerHTML = '';
            for (const docChange of snapshot.docChanges()) {
                const message = docChange.doc.data();
                const messageElement = document.createElement('div');
                messageElement.classList.add('message-bubble');
                const isSentByCurrentUser = message.senderId === currentUserId;
                messageElement.classList.add(isSentByCurrentUser ? 'sent' : 'received');

                // Detailed timestamp
                const timestamp = message.timestamp ? new Date(message.timestamp.toDate()).toLocaleString('fr-FR', {
                    year: 'numeric', month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }) : 'N/A';

                // Get display name for sender
                const senderDisplayName = await getDisplayName(message.senderId);
                const senderDisplay = isSentByCurrentUser ? 'Vous' : senderDisplayName;

                let messageContentHTML = `<p>${message.text || ''}</p>`; // Display text message if available

                // Handle file attachment display
                if (message.file) {
                    if (message.file.type.startsWith('image/')) {
                        messageContentHTML += `<img src="${message.file.url}" alt="${message.file.name}" class="mt-2 rounded-lg max-w-full h-auto">`;
                    } else if (message.file.type.startsWith('video/')) {
                        messageContentHTML += `<video controls src="${message.file.url}" class="mt-2 rounded-lg max-w-full h-auto"></video>`;
                    } else {
                        messageContentHTML += `<a href="${message.file.url}" target="_blank" class="text-blue-600 underline mt-2 block">Télécharger : ${message.file.name}</a>`;
                    }
                }

                messageElement.innerHTML = `
                    <div class="message-content">${messageContentHTML}</div>
                    <div class="message-info">${senderDisplay} - ${timestamp}</div>
                `;
                messagesArea.appendChild(messageElement);

                // Send notification for new messages not from current user
                if (docChange.type === "added" && !isSentByCurrentUser && Notification.permission === "granted") {
                    const notificationTitle = `Nouveau message de ${senderDisplayName}`;
                    const notificationBody = message.text || (message.file ? `Pièce jointe: ${message.file.name}` : 'Nouveau message');
                    new Notification(notificationTitle, {
                        body: notificationBody,
                        icon: 'https://placehold.co/48x48/007bff/ffffff?text=Chat' // Placeholder icon
                    });
                }
            }
            // Scroll to the bottom of the chat area after new messages are loaded
            messagesArea.scrollTop = messagesArea.scrollHeight;

        }, (error) => {
            displayError(`Erreur lors de l'écoute des messages: ${error.message}`);
        });

        // Setup typing indicator listener
        setupTypingListener(chatIdForTyping);

    } catch (error) {
        displayError(`Erreur lors de la configuration de l'écouteur de messages: ${error.message}`);
    }
}

// Function to set up real-time typing indicator listener
function setupTypingListener(chatId) {
    if (!db) {
        console.error("Base de données non initialisée pour l'écoute des indicateurs de saisie.");
        return;
    }
    try {
        const typingStatusCollectionRef = getTypingStatusCollectionRef(chatId);
        const q = query(typingStatusCollectionRef); // No orderBy needed for simple status

        unsubscribeTypingSnapshot = onSnapshot(q, async (snapshot) => {
            typingIndicatorArea.innerHTML = ''; // Clear previous indicators
            const typingUsers = [];
            for (const docSnap of snapshot.docs) {
                const typingStatus = docSnap.data();
                const userId = docSnap.id; // Document ID is the user ID
                if (userId !== currentUserId && typingStatus.isTyping) {
                    const displayName = await getDisplayName(userId);
                    typingUsers.push(displayName);
                }
            }

            if (typingUsers.length > 0) {
                typingIndicatorArea.textContent = `${typingUsers.join(', ')} est en train d'écrire...`;
                typingIndicatorArea.classList.remove('hidden');
            } else {
                typingIndicatorArea.textContent = '';
                typingIndicatorArea.classList.add('hidden');
            }
        }, (error) => {
            console.error("Erreur lors de l'écoute des indicateurs de saisie:", error);
        });
    } catch (error) {
        console.error("Erreur lors de la configuration de l'écouteur d'indicateurs de saisie:", error);
    }
}

// Function to set up real-time group members listener
function setupGroupMembersListener(groupId) {
    if (!db) {
        console.error("Base de données non initialisée pour l'écoute des membres du groupe.");
        return;
    }
    try {
        const groupDocRef = getGroupDocRef(groupId);
        unsubscribeGroupMembersSnapshot = onSnapshot(groupDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const groupData = docSnap.data();
                const members = groupData.members || [];
                if (members.length > 0) {
                    const memberNamesPromises = members.map(uid => getDisplayName(uid));
                    const memberNames = await Promise.all(memberNamesPromises);
                    groupMembersList.innerHTML = `Membres: ${memberNames.join(', ')}`;
                } else {
                    groupMembersList.innerHTML = 'Membres: Aucun';
                }
            } else {
                groupMembersList.innerHTML = 'Membres: Groupe non trouvé';
            }
        }, (error) => {
            console.error("Erreur lors de l'écoute des membres du groupe:", error);
        });
    } catch (error) {
        console.error("Erreur lors de la configuration de l'écouteur des membres du groupe:", error);
    }
}

// Function to add a member to the current group
addMemberBtn.addEventListener('click', async () => {
    const memberUidToAdd = addMemberInput.value.trim();
    if (!memberUidToAdd) {
        displayError("Veuillez entrer l'UID de l'utilisateur à ajouter.");
        return;
    }
    if (memberUidToAdd === currentUserId) {
        displayError("Vous êtes déjà membre de ce groupe.");
        return;
    }
    if (currentChatMode !== 'group' || !currentChatId) {
        displayError("Vous devez être dans un chat de groupe pour ajouter des membres.");
        return;
    }
    if (!db) {
        displayError("Base de données non initialisée.");
        return;
    }

    const groupDocRef = getGroupDocRef(currentChatId);
    try {
        // Check if the user to add exists (optional, but good practice)
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, memberUidToAdd);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            displayError("Cet UID d'utilisateur n'existe pas ou n'a pas de profil.");
            return;
        }

        await updateDoc(groupDocRef, {
            members: arrayUnion(memberUidToAdd)
        });
        addMemberInput.value = ''; // Clear input
        console.log(`Utilisateur ${memberUidToAdd} ajouté au groupe ${currentChatId}`);
    } catch (error) {
        displayError(`Erreur lors de l'ajout du membre: ${error.message}`);
    }
});


// Event listeners for chat mode buttons
publicChatBtn.addEventListener('click', () => switchChat('public'));
privateChatBtn.addEventListener('click', () => {
    privateRecipientIdInput.value = '';
    switchChat('private');
});
groupChatBtn.addEventListener('click', () => {
    groupChatIdInput.value = '';
    switchChat('group');
});

// Event listeners for input fields to trigger chat switching
privateRecipientIdInput.addEventListener('change', (e) => {
    const recipientId = e.target.value.trim();
    if (recipientId && recipientId !== currentUserId) {
        switchChat('private', recipientId);
    } else if (recipientId === currentUserId) {
        displayError("Vous ne pouvez pas chatter en privé avec votre propre ID. Veuillez entrer un autre ID.");
        privateRecipientIdInput.value = ''; // Clear the invalid input
    }
});

groupChatIdInput.addEventListener('change', (e) => {
    const groupId = e.target.value.trim();
    if (groupId) {
        switchChat('group', groupId);
    }
});

// Event listener for file input change
fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        fileNameDisplay.textContent = selectedFile.name;
    } else {
        fileNameDisplay.textContent = '';
    }
});

// Event listener for emoji button click
emojiButton.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent click from propagating to document
    emojiPicker.style.display = emojiPicker.style.display === 'grid' ? 'none' : 'grid';
});

// Hide emoji picker if clicking outside
document.addEventListener('click', (event) => {
    if (!emojiPicker.contains(event.target) && event.target !== emojiButton) {
        emojiPicker.style.display = 'none';
    }
});


// Event listener for message input to update typing status
messageInput.addEventListener('input', () => {
    if (currentUserId && (currentChatId || currentChatMode === 'public')) {
        setTypingStatus(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            setTypingStatus(false);
        }, 3000); // Set typing status to false after 3 seconds of inactivity
    }
});

// Event listeners for sending messages
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
�
