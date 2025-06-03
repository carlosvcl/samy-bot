// src/commands/utilidades/math.js
const { evaluate, help, lusolve, format } = require('mathjs'); // Importa evaluate e outras funções úteis do mathjs
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'math',
    aliases: ['calc', 'calcular', 'calculadora', 'matematica'],
    description: 'Resolve expressões matemáticas complexas. Suporta funções, constantes e matrizes.',
    category: 'avançados',
    args: true,
    usage: '<expressão matemática>',
    cooldown: 2, // Cooldown pequeno para evitar spam de cálculos
    async execute({ client, message, args }) {
        const expression = args.join(' ');

        if (!expression) {
            const usageEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('🧮 Comando Calculadora - Uso Inválido')
                .setDescription('Você precisa fornecer uma expressão matemática para eu calcular!')
                .addFields(
                    { name: '📝 Como Usar', value: `\`${process.env.PREFIX}${this.name} ${this.usage}\`` },
                    { name: '💡 Exemplos', value: `\`${process.env.PREFIX}math 2 * (3 + 4)\`\n\`${process.env.PREFIX}math sqrt(16) + sin(pi/2)\`\n\`${process.env.PREFIX}math 1 inch to cm\`` }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [usageEmbed] });
        }

        try {
            let result = evaluate(expression);
            let resultString;

            // Formatar o resultado para melhor leitura
            // 'format' do mathjs ajuda com números grandes, notação científica, etc.
            // Se for uma função (ex: resultado de 'f(x) = x^2'), mathjs pode retornar a função.
            if (typeof result === 'function') {
                resultString = "Resultado é uma definição de função. Para calcular, forneça os valores (ex: `f(2)` se `f(x)=x^2`).";
            } else if (typeof result === 'object' && result !== null && typeof result.toString === 'function' && result.toString() !== '[object Object]') {
                // Para matrizes ou objetos especiais do mathjs
                resultString = format(result, { precision: 14 }); // Ajuste a precisão conforme necessário
            } else if (typeof result === 'number' && (isNaN(result) || !isFinite(result))) {
                resultString = "Resultado indefinido ou não é um número real (ex: divisão por zero, log de número negativo).";
            }
            else {
                resultString = format(result, { precision: 14 });
            }
            
            if (resultString.length > 1000) { // Limite para valor de campo do embed
                resultString = resultString.substring(0, 997) + "... (resultado truncado)";
            }

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('🧮 Resultado do Cálculo Matemático')
                .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({dynamic: true})})
                .addFields(
                    { name: '📥 Expressão Fornecida:', value: `\`\`\`${expression.substring(0, 1000)}\`\`\`` },
                    { name: '💡 Resultado:', value: `\`\`\`${resultString}\`\`\`` },
                    { 
                        name: 'ℹ️ Dica de Funções Suportadas (exemplos):', 
                        value: '`sqrt(x)`, `log(x, base?)`, `sin(x)`, `cos(x)`, `tan(x)` (em radianos), `abs(x)`,\n`round(x, n?)`, `pow(base, exp)`, `nthRoot(x, root?)`, `det([[a,b],[c,d]])` (determinante)\nConstantes: `pi`, `e`. Unidades: `1 inch to cm`.'
                    }
                )
                .setTimestamp()
                .setFooter({ text: `Calculado por ${client.user.username} | Solicitado por: ${message.author.tag}`, iconURL: client.user.displayAvatarURL() });
            message.channel.send({ embeds: [embed] });

        } catch (e) {
            console.error(`Erro no comando math para expressão "${expression}":`, e.message);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000') // Vermelho para erro
                .setTitle('❌ Erro de Cálculo')
                .setDescription("Não consegui resolver a expressão matemática fornecida. Verifique a sintaxe.")
                .addFields(
                    { name: "Expressão Tentada:", value: `\`\`\`${expression.substring(0,1000)}\`\`\``},
                    { name: "Detalhe do Erro:", value: `\`${e.message.substring(0,1000)}\``},
                    { name: "🤔 Precisa de Ajuda com a Sintaxe?", value: "Consulte a [documentação do mathjs](https://mathjs.org/docs/expressions/syntax.html) para operadores e funções."}
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [errorEmbed] });
        }
    }
};