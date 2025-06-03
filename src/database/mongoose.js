// src/database/mongoose.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI); //MONGO_URI do .env
        console.log('💾 Conectado com sucesso ao MongoDB.');
    } catch (err) {
        console.error('❌ Erro ao conectar ao MongoDB:', err.message);
        process.exit(1); // Encerra o processo se não conseguir conectar
    }
};

module.exports = connectDB;