// src/commands/utilidades/color.js
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas'); // Lembre-se: npm install canvas

// --- MODIFICAÇÃO NA IMPORTAÇÃO ---
const convertFromLibrary = require('color-convert'); // Importa o módulo principal
const convert = convertFromLibrary.default || convertFromLibrary; // Usa .default se existir, senão o objeto principal
// Adicionaremos uma verificação para garantir que 'convert' e 'convert.keyword' estão corretos.
// --- FIM DA MODIFICAÇÃO ---

module.exports = {
    name: 'color',
    aliases: ['cor', 'hexinfo', 'rgbinfo', 'hslinfo'],
    description: 'Mostra informações sobre uma cor (HEX, RGB, HSL) e uma prévia.',
    category: 'utilidades',
    args: true,
    usage: '<#HEX | rgb(r,g,b) | hsl(h,s,l) | nome_da_cor_css>',
    cooldown: 3,
    async execute({ client, message, args }) {
        // 1. VERIFICAÇÃO DE ARGUMENTOS (como antes)
        if (!args.length || args.join(" ").trim() === "") {
            const usageEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('🎨 Comando Cor - Uso Inválido')
                .setDescription(`Você precisa fornecer uma cor para que eu possa te mostrar as informações sobre ela!`)
                .addFields(
                    { name: '📝 Como Usar', value: `\`${process.env.PREFIX}${this.name} ${this.usage}\`` },
                    { name: '💡 Exemplos', value: `\`${process.env.PREFIX}color #FF69B4\`\n\`${process.env.PREFIX}color rgb(255,105,180)\`\n\`${process.env.PREFIX}color blue\`` }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [usageEmbed] });
        }

        const inputColor = args.join(' ').toLowerCase().trim();
        let hexColor, rgbColor, hslColor, colorNameAttempt = null;

        // VERIFICAÇÃO ADICIONAL PARA 'convert'
        if (!convert || typeof convert.keyword === 'undefined' || typeof convert.keyword.hex !== 'function') {
            console.error("[Comando Color] Biblioteca color-convert não carregada corretamente ou 'convert.keyword.hex' não é uma função. Estrutura de 'convertFromLibrary':", convertFromLibrary);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Erro Interno do Bot')
                .setDescription("Ocorreu um problema com o serviço de conversão de cores. Por favor, avise um administrador.")
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [errorEmbed] });
        }

        try {
            if (inputColor.startsWith('#')) {
                hexColor = inputColor.substring(0, 7).toUpperCase();
                if (!/^#[0-9A-F]{6}$/i.test(hexColor) && !/^#[0-9A-F]{3}$/i.test(hexColor)) {
                    throw new Error("Formato HEX inválido. Use #RRGGBB ou #RGB.");
                }
                if (hexColor.length === 4) {
                    hexColor = `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`;
                }
                rgbColor = convert.hex.rgb(hexColor.slice(1));
                hslColor = convert.hex.hsl(hexColor.slice(1));
            } else if (inputColor.startsWith('rgb')) {
                const match = inputColor.match(/rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)/);
                if (!match) throw new Error("Formato RGB inválido. Use rgb(r,g,b).");
                rgbColor = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
                if (rgbColor.some(val => val < 0 || val > 255)) throw new Error("Valores RGB devem estar entre 0 e 255.");
                hexColor = "#" + convert.rgb.hex(rgbColor);
                hslColor = convert.rgb.hsl(rgbColor);
            } else if (inputColor.startsWith('hsl')) {
                 const match = inputColor.match(/hsl\((\d{1,3}),\s*(\d{1,3})%?,\s*(\d{1,3})%?\)/);
                 if(!match) throw new Error("Formato HSL inválido. Use hsl(h,s%,l%).");
                 hslColor = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
                 if(hslColor[0] < 0 || hslColor[0] > 360 || hslColor[1] < 0 || hslColor[1] > 100 || hslColor[2] < 0 || hslColor[2] > 100) {
                     throw new Error("Valores HSL inválidos (H: 0-360, S/L: 0-100%).");
                 }
                 hexColor = "#" + convert.hsl.hex(hslColor);
                 rgbColor = convert.hsl.rgb(hslColor);
            } else { 
                const keywordHex = convert.keyword.hex(inputColor); 
                if (!keywordHex || typeof keywordHex !== 'string') { 
                    throw new Error("Nome de cor CSS inválido ou não reconhecido.");
                }
                hexColor = "#" + keywordHex;
                rgbColor = convert.keyword.rgb(inputColor);
                hslColor = convert.keyword.hsl(inputColor);
                colorNameAttempt = inputColor.charAt(0).toUpperCase() + inputColor.slice(1);
            }
        } catch (e) {
            const errorReplyEmbed = new EmbedBuilder()
                .setColor('#FF0000') // Vermelho para erro
                .setTitle('❌ Cor Inválida ou Erro na Conversão')
                .setDescription(`Não consegui entender ou converter a cor: \`${inputColor}\`.`)
                .addFields({ name: "Detalhe do Erro", value: e.message || "Erro desconhecido."})
                .addFields({ name: "Formatos Suportados:", value: "- HEX: `#RRGGBB` ou `#RGB`\n- RGB: `rgb(255,105,180)`\n- HSL: `hsl(330,100%,71%)`\n- Nomes de Cores CSS (em inglês, ex: `blue`, `lightpink`)"})
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [errorReplyEmbed] });
        }

        // Criar uma imagem de prévia da cor
        const canvas = createCanvas(100, 100);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = hexColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'color-preview.png' });

        const embed = new EmbedBuilder()
            .setColor(hexColor)
            .setTitle(colorNameAttempt ? `🎨 Cor: ${colorNameAttempt} (${hexColor.toUpperCase()})` : `🎨 Informações da Cor: ${hexColor.toUpperCase()}`)
            .setThumbnail('attachment://color-preview.png')
            .addFields(
                { name: 'HEX', value: `\`${hexColor.toUpperCase()}\``, inline: true },
                { name: 'RGB', value: `\`rgb(${rgbColor.join(', ')})\``, inline: true },
                { name: 'HSL', value: `\`hsl(${hslColor[0]}, ${hslColor[1]}%, ${hslColor[2]}%)\``, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        message.channel.send({ embeds: [embed], files: [attachment] });
    }
};