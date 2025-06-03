// src/commands/informacoes/clima.js
const { EmbedBuilder } = require('discord.js');
const axios = require('axios'); // Lembre-se de instalar: npm install axios

module.exports = {
    name: 'clima',
    aliases: ['weather', 'tempo', 'previsao'],
    description: 'Mostra informações do clima de uma cidade.',
    category: 'informações',
    args: true,
    usage: '<cidade>',
    async execute({ client, message, args }) {
        const cityName = args.join(' ');
        const apiKey = process.env.OPENWEATHER_API_KEY; // Certifique-se que está no seu .env
        
        if (!apiKey) {
            console.error("Chave da API OpenWeatherMap não configurada no .env");
            return message.reply('Desculpe, a funcionalidade de clima não está configurada corretamente no momento.');
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${apiKey}&units=metric&lang=pt_br`;

        try {
            const response = await axios.get(url);
            const data = response.data;

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle(`☀️ Clima em ${data.name}, ${data.sys.country}`)
                .setDescription(`Condições climáticas atuais para a localização solicitada:`)
                .setThumbnail(`http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`)
                .addFields(
                    { name: '🌡️ Temperatura', value: `${data.main.temp}°C (Sensação: ${data.main.feels_like}°C)`, inline: true },
                    { name: '🌬️ Vento', value: `${data.wind.speed} m/s (Direção: ${data.wind.deg}°)`, inline: true },
                    { name: '💧 Umidade', value: `${data.main.humidity}%`, inline: true },
                    { name: '📝 Descrição Geral', value: data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1), inline: false },
                    { name: '📊 Pressão Atmosférica', value: `${data.main.pressure} hPa`, inline: true },
                    { name: '👁️ Visibilidade', value: `${data.visibility / 1000} km`, inline: true },
                    { name: '☁️ Nuvens', value: `${data.clouds.all}%`, inline: true },
                    { name: '🌇 Nascer do Sol', value: `<t:${data.sys.sunrise}:t>`, inline: true },
                    { name: '🌆 Pôr do Sol', value: `<t:${data.sys.sunset}:t>`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Powered by OpenWeatherMap | Solicitado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [embed] });

        } catch (error) {
            if (error.response && error.response.status === 404) {
                message.reply(`Não consegui encontrar informações do clima para a cidade "${cityName}". Verifique se o nome está correto.`);
            } else if (error.response && error.response.status === 401) {
                 console.error("Erro na API OpenWeatherMap: Chave inválida ou não autorizada.");
                 message.reply('Ocorreu um problema com a configuração da API de clima.');
            }
             else {
                console.error("Erro ao buscar clima:", error.message);
                message.reply('Ocorreu um erro ao tentar buscar as informações do clima.');
            }
        }
    }
};