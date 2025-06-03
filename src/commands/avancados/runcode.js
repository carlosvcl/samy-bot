// src/commands/avancados/runcode.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js'); // Adicionado ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType
const axios = require('axios');

const PISTON_API_URL = 'https://emkc.org/api/v2/piston/execute';
const PISTON_RUNTIMES_URL = 'https://emkc.org/api/v2/piston/runtimes';

module.exports = {
    name: 'runcode',
    aliases: ['code', 'exec', 'run'],
    description: 'Executa um trecho de código em uma linguagem especificada usando a API Piston.',
    category: 'avançados',
    usage: '<linguagem> ```código``` OU --langs',
    // filePath: __filename,

    async execute({ client, message, args, prefix }) {
        const currentPrefix = prefix || client.prefix || process.env.PREFIX || "s!";

        if (args.length === 0 || (args.length < 2 && !(args[0].toLowerCase() === '--langs' || args[0].toLowerCase() === '--languages'))) {
            // ... (embed de ajuda como antes) ...
            const usageEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`💡 Como usar o Comando \`${currentPrefix}runcode\``)
                .setDescription('Execute trechos de código em diversas linguagens diretamente no Discord, usando um ambiente seguro (sandbox).')
                .addFields(
                    { name: '📝 Sintaxe Principal', value: `\`\`\`\n${currentPrefix}runcode <linguagem>\n\`\`\`\n\`\`\`\n[Seu código aqui]\n\`\`\`` },
                    { name: '▶️ Exemplo Prático', value: `\`\`\`\n${currentPrefix}runcode javascript\n\`\`\`\n\`\`\`javascript\nconsole.log("Olá, Samy!");\n\`\`\`` },
                    { name: '📚 Ver Linguagens Suportadas', value: `Para listar todas as linguagens e versões disponíveis, use:\n\`\`\`\n${currentPrefix}runcode --langs\n\`\`\`` },
                    { name: '✍️ Dica para Código Multilinha', value: "Para enviar códigos com múltiplas linhas, use os **blocos de código** do Discord (envolva seu código com três crases: \\`\\`\\`).\nVocê pode opcionalmente especificar a linguagem no início do bloco (ex: \\`\\`\\`javascript) ou como o primeiro argumento do comando." }
                )
                .setFooter({ text: `Lembre-se de usar o prefixo correto: ${currentPrefix} | Samy Bot` });
            return message.reply({ embeds: [usageEmbed] });
        }

        let language = args.shift().toLowerCase();
        let codeToRun = args.join(' ');

        if (language === '--langs' || language === '--languages') {
            try {
                const response = await axios.get(PISTON_RUNTIMES_URL);
                const runtimes = response.data;

                if (!runtimes || runtimes.length === 0) {
                    return message.channel.send({content: "Não foi possível carregar a lista de linguagens ou ela está vazia."});
                }

                const embeds = [];
                let currentDescription = "";
                let pageCount = 1;

                for (const runtime of runtimes) {
                    const langEntry = `\n• **${runtime.language}** (v${runtime.version})${runtime.aliases.length > 0 ? ` - Aliases: \`${runtime.aliases.join('`, `')}\`` : ''}`;
                    if (currentDescription.length + langEntry.length > 1950) { // Limite aproximado para descrição do embed
                        embeds.push(
                            new EmbedBuilder()
                                .setColor('#FF69B4')
                                .setTitle(`📚 Linguagens Suportadas (Pág. ${pageCount})`)
                                .setDescription(currentDescription)
                                .setFooter({ text: "Algumas linguagens podem ter múltiplos aliases." })
                        );
                        currentDescription = ""; // Reinicia para a próxima página
                        pageCount++;
                    }
                    currentDescription += langEntry;
                }
                // Adiciona a última página/chunk
                if (currentDescription) {
                    embeds.push(
                        new EmbedBuilder()
                            .setColor('#FF69B4')
                            .setTitle(`📚 Linguagens Suportadas (Pág. ${pageCount})`)
                            .setDescription(currentDescription)
                            .setFooter({ text: `Página ${pageCount}/${pageCount} | Samy Bot` }) // Atualiza o footer da última página
                    );
                }
                
                // Atualiza o footer das páginas anteriores para incluir o total de páginas
                for(let i = 0; i < embeds.length -1; i++){
                    const currentFooter = embeds[i].data.footer?.text || "";
                    embeds[i].setFooter({ text: currentFooter.replace("Samy Bot", `Página ${i+1}/${embeds.length} | Samy Bot`) });
                }


                if (embeds.length === 0) {
                    return message.channel.send({ content: "Nenhuma linguagem encontrada para exibir." });
                }

                let currentPage = 0;

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_lang_page')
                            .setLabel('⬅️ Anterior')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true), // Começa desabilitado
                        new ButtonBuilder()
                            .setCustomId('next_lang_page')
                            .setLabel('Próxima ➡️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(embeds.length === 1) // Desabilita se só tiver uma página
                    );

                const langMessage = await message.channel.send({
                    embeds: [embeds[currentPage]],
                    components: embeds.length > 1 ? [row] : [] // Só adiciona botões se houver mais de uma página
                });

                if (embeds.length <= 1) return; // Não precisa de coletor se só tem uma página

                const collector = langMessage.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 120000 // 2 minutos de tempo para interação
                });

                collector.on('collect', async interaction => {
                    if (interaction.user.id !== message.author.id) {
                        return interaction.reply({ content: 'Apenas quem pediu a lista pode navegar pelas páginas!', ephemeral: true });
                    }

                    if (interaction.customId === 'prev_lang_page') {
                        currentPage--;
                    } else if (interaction.customId === 'next_lang_page') {
                        currentPage++;
                    }

                    row.components[0].setDisabled(currentPage === 0); // Botão "Anterior"
                    row.components[1].setDisabled(currentPage === embeds.length - 1); // Botão "Próxima"

                    try {
                        await interaction.update({
                            embeds: [embeds[currentPage]],
                            components: [row]
                        });
                    } catch (updateError) {
                        console.error("[RunCodeCmd] Erro ao atualizar paginação de linguagens:", updateError);
                    }
                });

                collector.on('end', collected => {
                    // Opcional: Desabilitar os botões após o tempo limite
                    row.components.forEach(button => button.setDisabled(true));
                    if (langMessage.editable) { // Verifica se a mensagem ainda pode ser editada
                        langMessage.edit({ components: [row] }).catch(console.error);
                    }
                });
                return;

            } catch (error) {
                console.error("[RunCodeCmd] Erro ao buscar runtimes da Piston:", error);
                if (error.code === 'ERR_INVALID_URL') {
                    console.error("[RunCodeCmd] Detalhe do erro ERR_INVALID_URL - input recebido:", error.input);
                }
                return message.reply({content: "Não consegui buscar a lista de linguagens no momento. Verifique os logs do bot."});
            }
        }

        // ... (resto do código para execução do código como antes) ...
        // Extrair código de dentro de blocos de código
        if (codeToRun.startsWith('```') && codeToRun.endsWith('```')) {
            codeToRun = codeToRun.substring(3, codeToRun.length - 3);
            const firstLine = codeToRun.split('\n')[0].trim();
            if (firstLine.toLowerCase() === language) {
                codeToRun = codeToRun.substring(firstLine.length).trimStart();
            }
        } else if (codeToRun.startsWith('`') && codeToRun.endsWith('`')) {
             codeToRun = codeToRun.substring(1, codeToRun.length - 1);
        }

        if (!codeToRun) {
            return message.reply({ content: "Por favor, forneça o código que você quer executar." });
        }

        try {
            const executionMessage = await message.reply({ content: `Executando seu código \`${language}\`...` });
            
            const response = await axios.post(PISTON_API_URL, {
                language: language,
                version: '*',
                files: [{
                    name: `code.${language.split(/[^a-zA-Z0-9]/)[0] || 'txt'}`,
                    content: codeToRun
                }],
            });

            const result = response.data;
            let output = '';
            let errorOutput = '';

            if (result.run && result.run.stdout) output = result.run.stdout.substring(0, 1000);
            if (result.run && result.run.stderr) errorOutput = result.run.stderr.substring(0, 500);
            if (result.compile && result.compile.stderr && !output) {
                errorOutput = `Erro de Compilação:\n${result.compile.stderr.substring(0, 500)}`;
            }

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`🖥️ Execução de Código: ${language.toUpperCase()}`)
                .setTimestamp()
                .setFooter({ text: `Executado para: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (output) embed.addFields({ name: 'Saída (stdout):', value: `\`\`\`\n${output}\n\`\`\`` });
            if (errorOutput) embed.addFields({ name: 'Erro (stderr/compile):', value: `\`\`\`\n${errorOutput}\n\`\`\`` });
            
            if (!output && !errorOutput && result.run && result.run.output === '') {
                 embed.addFields({ name: 'Saída:', value: 'Nenhuma saída ou erro retornado (execução bem-sucedida sem output).' });
            } else if (!output && !errorOutput){
                 embed.addFields({ name: 'Saída:', value: 'Nenhuma saída ou erro retornado.' });
            }
            
            if (result.run && result.run.code !== undefined) {
                embed.addFields({ name: 'Código de Saída', value: `\`${result.run.code}\``, inline: true });
            }

            await executionMessage.edit({ content: "Resultado da execução:", embeds: [embed] });

        } catch (error) {
            console.error("[RunCodeCmd] Erro ao executar código via Piston:", error.response ? error.response.data : error.message);
            if (error.code === 'ERR_INVALID_URL') {
                console.error("[RunCodeCmd] Detalhe do erro ERR_INVALID_URL - input recebido:", error.input);
            }
            let errorMsg = "❌ Ocorreu um erro ao tentar executar o código.";
            if(error.response && error.response.data && error.response.data.message) {
                if (error.response.data.message.includes("Unable to find runtime for language")) {
                     errorMsg = `❌ Linguagem \`${language}\` não suportada ou versão inválida. Tente \`${currentPrefix}runcode --langs\` para ver as opções.`;
                } else {
                    errorMsg += `\nDetalhe da API: \`${error.response.data.message}\``;
                }
            } else if (error.message) {
                 errorMsg += `\nDetalhe: \`${error.message}\``;
            }
            await message.reply({ content: errorMsg });
        }
    }
};