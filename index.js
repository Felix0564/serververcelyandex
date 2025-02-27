const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Stocker les abonnements et les dernières positions
const subscriptions = new Map(); // vehicleId -> Set of socket ids
const lastPositions = new Map(); // vehicleId -> position data

// Route de base pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
  res.send('Serveur de suivi GPS en ligne');
});

io.on('connection', (socket) => {
  console.log('Client connecté:', socket.id);

  // Quand un émetteur envoie sa position
  socket.on('updateLocation', (locationData) => {
    const { vehicleId } = locationData;
    
    if (!vehicleId) {
      console.error('Données de position sans vehicleId');
      return;
    }
    
    console.log(`Position mise à jour pour ${vehicleId}:`, locationData);
    
    // Stocker la dernière position
    lastPositions.set(vehicleId, locationData);
    
    // Diffuser la mise à jour à tous les abonnés de ce véhicule
    const subscribers = subscriptions.get(vehicleId) || new Set();
    
    if (subscribers.size > 0) {
      console.log(`Diffusion de la position à ${subscribers.size} abonnés`);
      io.emit('locationUpdate', locationData);
    }
  });

  // Quand un client s'abonne aux mises à jour d'un véhicule
  socket.on('subscribeToVehicle', ({ vehicleId }) => {
    console.log(`Client ${socket.id} s'abonne au véhicule ${vehicleId}`);
    
    if (!subscriptions.has(vehicleId)) {
      subscriptions.set(vehicleId, new Set());
    }
    
    // Ajouter ce socket aux abonnés
    subscriptions.get(vehicleId).add(socket.id);
    
    // Envoyer immédiatement la dernière position connue si disponible
    const lastPosition = lastPositions.get(vehicleId);
    if (lastPosition) {
      socket.emit('locationUpdate', lastPosition);
    }
  });

  // Quand un client se désabonne
  socket.on('unsubscribeFromVehicle', ({ vehicleId }) => {
    console.log(`Client ${socket.id} se désabonne du véhicule ${vehicleId}`);
    
    if (subscriptions.has(vehicleId)) {
      subscriptions.get(vehicleId).delete(socket.id);
    }
  });

  // Quand un client se déconnecte
  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
    
    // Supprimer ce client de tous les abonnements
    for (const [vehicleId, subscribers] of subscriptions.entries()) {
      if (subscribers.has(socket.id)) {
        subscribers.delete(socket.id);
        console.log(`Client désabonné du véhicule ${vehicleId}`);
      }
    }
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

module.exports = app;
