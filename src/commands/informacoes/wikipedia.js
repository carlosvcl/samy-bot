// src/commands/informacoes/wikipedia.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
    name: 'wikipedia',
    aliases: ['wiki'],
    description: 'Busca informações detalhadas de um termo na Wikipedia (pt).',
    args: true,
    usage: '<termo de busca>',
    category: 'informações',

    async execute({ client, message, args }) {
        if (!args || args.length === 0) {
            try { return await message.reply('Você precisa fornecer um termo para pesquisar! Ex: `!wiki Brasil`'); }
            catch (e) { console.error("Erro ao enviar mensagem de 'args faltando':", e); return; }
        }

        const searchTerm = args.join(' ').trim();

        if (!searchTerm) {
            try { return await message.reply('Você precisa fornecer um termo de busca válido!'); }
            catch (e) { console.error("Erro ao enviar mensagem de 'termo inválido':", e); return; }
        }

        const searchApiUrl = `https://pt.wikipedia.org/w/api.php?action=query&format=json&list=search&utf8=1&srsearch=${encodeURIComponent(searchTerm)}&srlimit=1&srprop=snippet`;

        try {
            const searchResponse = await axios.get(searchApiUrl);

            if (!searchResponse.data || searchResponse.data.error) {
                const apiError = searchResponse.data && searchResponse.data.error;
                const infoMsg = apiError && apiError.info ? apiError.info : 'Não foi possível obter uma resposta válida da Wikipedia.';
                try { return await message.reply(`Erro ao consultar a Wikipedia: ${infoMsg}`); } catch (e) { console.error("API Search Error Msg:", e); return; }
            }
            if (!searchResponse.data.query || !searchResponse.data.query.search || searchResponse.data.query.search.length === 0) {
                try { return await message.reply(`Não consegui encontrar nenhum artigo para "${searchTerm}" na Wikipedia.`); } catch (e) { console.error("API Search No Result Msg:", e); return; }
            }
            
            const searchResult = searchResponse.data.query.search[0];
            const pageId = searchResult.pageid;
            let initialPageTitle = searchResult.title; // Título da busca inicial
            
            let initialSnippet = searchResult.snippet
                .replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\(\s*;\s*\)/g, '')
                .replace(/\s{2,}/g, ' ').trim();

            // API call para informações detalhadas
            const infoApiUrl = `https://pt.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=info|pageimages|categories|pageterms|revisions&inprop=url|displaytitle&pithumbsize=300&pilimit=1&cllimit=5&clshow=!hidden&wbptterms=description&rvprop=timestamp|ids&rvlimit=1&rvdir=newer&format=json`;
            
            let pageTitle = initialPageTitle;
            let canonicalUrl = `https://pt.wikipedia.org/?curid=${pageId}`;
            let lastModifiedDate = null;
            let pageSize = null;
            let revisionCount = null;
            let thumbnailUrl = null;
            let categories = [];
            let wikidataDescription = null;
            let creationDate = null;

            try {
                const infoResponse = await axios.get(infoApiUrl);
                if (infoResponse.data && infoResponse.data.query && infoResponse.data.query.pages) {
                    const pageData = infoResponse.data.query.pages[pageId];
                    if (pageData) {
                        pageTitle = pageData.title || initialPageTitle; // Usa o título canônico se disponível
                        canonicalUrl = pageData.fullurl || canonicalUrl;
                        if (pageData.touched) lastModifiedDate = new Date(pageData.touched);
                        if (pageData.length) pageSize = pageData.length;
                        if (pageData.revisions && pageData.revisions.length > 0 && pageData.revisions[0].timestamp) {
                             // Isso pega a data da *primeira* revisão (criação)
                            creationDate = new Date(pageData.revisions[0].timestamp);
                        }
                        // O número total de revisões está em 'pageData.revisions' (a contagem, não o array de uma)
                        // Se rvlimit=1, 'pageData.revisions' (o array) terá 1 item. O count é 'pageData.revcount' ou 'pageData.revisions' (o número)
                        // A API retorna 'revisions' como a contagem total quando prop=info é usado.
                        // Se 'pageData.revisions' for um array (por causa de rvprop=timestamp),
                        // precisamos pegar o total de revisões de 'pageData.revcount' (se disponível com prop=info)
                        // ou simplesmente o campo `revisions` se ele for um número.
                        // A API devolve `revisions: <number>` com `prop=info`.
                        revisionCount = pageData.revisions; // Se `prop=info` foi incluído, este `revisions` é a contagem.

                        if (pageData.thumbnail && pageData.thumbnail.source) {
                            thumbnailUrl = pageData.thumbnail.source;
                        }
                        if (pageData.categories) {
                            categories = pageData.categories.map(cat => cat.title.replace(/^Categoria:/, '').trim()).slice(0, 5);
                        }
                        if (pageData.terms && pageData.terms.description && pageData.terms.description.length > 0) {
                            wikidataDescription = pageData.terms.description[0];
                        }
                    }
                }
            } catch (infoError) {
                console.error("Erro ao buscar informações detalhadas da Wikipedia:", infoError.message);
                // Continua mesmo se falhar, usando os dados básicos.
            }

            let mainDescription = wikidataDescription || initialSnippet;
            if (mainDescription.length > 450) {
                mainDescription = mainDescription.substring(0, 447) + '...';
            }
            if (!mainDescription || mainDescription === "..." || mainDescription.toLowerCase() === "null") {
                mainDescription = "Não foi possível obter uma descrição para este artigo.";
            }

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`📖 ${pageTitle}`)
                .setURL(canonicalUrl)
                .setAuthor({ name: 'Wikipedia - A Enciclopédia Livre', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png', url: 'https://pt.wikipedia.org' })
                .setDescription(mainDescription);

            if (thumbnailUrl) {
                embed.setThumbnail(thumbnailUrl);
            }

            // Adicionando campos de forma organizada
            const fieldsToAdd = [];
            fieldsToAdd.push({ name: 'Termo Pesquisado', value: `\`${searchTerm}\``, inline: true });

            if (creationDate) {
                fieldsToAdd.push({ name: 'Criado em', value: `<t:${Math.floor(creationDate.getTime() / 1000)}:d>`, inline: true });
            } else {
                 fieldsToAdd.push({ name: 'Criado em', value: 'N/D', inline: true }); // Espaço reservado ou N/D
            }

            if (lastModifiedDate) {
                fieldsToAdd.push({ name: 'Última Modificação', value: `<t:${Math.floor(lastModifiedDate.getTime() / 1000)}:R>`, inline: true });
                embed.setTimestamp(lastModifiedDate);
            } else {
                fieldsToAdd.push({ name: 'Última Modificação', value: 'N/D', inline: true });
                embed.setTimestamp();
            }
            
            if (revisionCount !== undefined && revisionCount !== null) { // revisionCount pode ser 0
                fieldsToAdd.push({ name: 'Revisões', value: `${revisionCount.toLocaleString('pt-BR')}`, inline: true });
            } else {
                fieldsToAdd.push({ name: 'Revisões', value: 'N/D', inline: true });
            }

            if (pageSize) {
                fieldsToAdd.push({ name: 'Tamanho', value: `~${(pageSize / 1024).toFixed(1)} KB`, inline: true });
            } else {
                fieldsToAdd.push({ name: 'Tamanho', value: 'N/D', inline: true });
            }
            
            // Adiciona um campo vazio para preencher a linha se tivermos 5 campos inline,
            // ou se o próximo campo (Categorias) for full-width.
            // Se o número de campos inline for múltiplo de 3 (o máximo por linha no desktop), não precisa.
            // No nosso caso, temos 5 campos inline, então eles ocuparão duas linhas.
            // A linha de "Categorias" virá abaixo.

            if (categories.length > 0) {
                const categoryText = categories.join(', ');
                fieldsToAdd.push({ name: 'Categorias', value: categoryText.length > 1020 ? categoryText.substring(0, 1017) + '...' : categoryText, inline: false });
            }
            
            embed.addFields(fieldsToAdd);
            embed.setFooter({ text: `Fonte: pt.wikipedia.org | Solicitado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel(`Ler "${pageTitle.length > 50 ? pageTitle.substring(0, 47) + '...' : pageTitle}" na Wikipedia`)
                        .setStyle(ButtonStyle.Link)
                        .setURL(canonicalUrl)
                );

            await message.channel.send({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Erro geral ao buscar na Wikipedia:', error.message);
            if (error.response) { console.error('Detalhes do erro de resposta da API:', JSON.stringify(error.response.data, null, 2)); }
            else if (error.request) { console.error('Detalhes do erro de requisição:', error.request); }

            let friendlyErrorMessage = 'Desculpe, ocorreu um erro ao tentar pesquisar na Wikipedia.';
            if (axios.isAxiosError(error)) {
                if (error.response) { friendlyErrorMessage += ` (Erro da API: ${error.response.status})`; }
                else if (error.request) { friendlyErrorMessage = 'Não consegui me conectar à Wikipedia.'; }
            }
            try { await message.reply(friendlyErrorMessage); } catch (sendError) { console.error("Erro ao enviar msg de erro geral:", sendError); }
        }
    }
};