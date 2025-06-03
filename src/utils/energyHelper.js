// src/utils/energyHelper.js
const ENERGY_REGEN_RATE_PER_MINUTE = 1; // Quantidade de energia regenerada por minuto
const MAX_ENERGY_DEFAULT = 100; // Máximo de energia padrão (pode ser do userProfile.energy.max)

async function updateUserEnergy(userProfile) {
    if (!userProfile) return null; // Se o perfil não for passado

    // Inicializa a estrutura de energia se não existir (deve ser raro se findOrCreate for usado corretamente)
    if (!userProfile.energy) {
        userProfile.energy = { current: MAX_ENERGY_DEFAULT, max: MAX_ENERGY_DEFAULT, lastRegenTimestamp: new Date() };
    }
    // Garante que max e lastRegenTimestamp existem
    if (typeof userProfile.energy.max !== 'number') userProfile.energy.max = MAX_ENERGY_DEFAULT;
    if (!userProfile.energy.lastRegenTimestamp) userProfile.energy.lastRegenTimestamp = new Date();


    const now = new Date();
    const lastRegen = userProfile.energy.lastRegenTimestamp;
    const diffMs = now.getTime() - lastRegen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes > 0 && userProfile.energy.current < userProfile.energy.max) {
        const energyToRegen = diffMinutes * ENERGY_REGEN_RATE_PER_MINUTE;
        const newEnergy = Math.min(userProfile.energy.current + energyToRegen, userProfile.energy.max);

        if (newEnergy > userProfile.energy.current) {
            userProfile.energy.current = newEnergy;
            // Atualiza o timestamp para o momento da última regeneração efetiva (não necessariamente 'now')
            // Avança o lastRegen pelo tempo exato que foi regenerado.
            const minutesEffectivelyRegenerated = Math.floor((newEnergy - (userProfile.energy.current - energyToRegen)) / ENERGY_REGEN_RATE_PER_MINUTE);
            if (minutesEffectivelyRegenerated > 0) { // Apenas atualiza se houve regeneração efetiva
                 userProfile.energy.lastRegenTimestamp = new Date(lastRegen.getTime() + minutesEffectivelyRegenerated * 60 * 1000);
            } else if (userProfile.energy.current === userProfile.energy.max) { // Se atingiu o máximo
                userProfile.energy.lastRegenTimestamp = now; // Reset para agora se está cheio
            }
            // Não precisa salvar aqui, o comando que chamou o helper salvará.
        } else if (userProfile.energy.current === userProfile.energy.max) {
             // Se já estava no máximo, mas passou tempo, atualiza o timestamp para 'now'
             // para evitar que no próximo cálculo considere um tempo muito antigo.
             userProfile.energy.lastRegenTimestamp = now;
        }
    }
    return userProfile; // Retorna o perfil atualizado (ainda não salvo)
}

module.exports = { updateUserEnergy, MAX_ENERGY_DEFAULT, ENERGY_REGEN_RATE_PER_MINUTE };