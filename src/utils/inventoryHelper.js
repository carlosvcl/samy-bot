// src/utils/inventoryHelper.js
async function addItemToInventory(userProfile, itemIdToAdd, quantityToAdd) {
    const itemIndex = userProfile.inventory.findIndex(invItem => invItem.itemId.equals(itemIdToAdd));

    if (itemIndex > -1) {
        userProfile.inventory[itemIndex].quantity += quantityToAdd;
    } else {
        userProfile.inventory.push({ itemId: itemIdToAdd, quantity: quantityToAdd });
    }
    // O userProfile.save() geralmente é chamado no comando após todas as modificações.
    // Se este helper for o único a modificar, pode salvar aqui.
    // await userProfile.save(); 
    return userProfile; // Retorna o perfil modificado para encadeamento ou salvamento posterior
}

async function removeItemFromInventory(userProfile, itemIdToRemove, quantityToRemove) {
    const itemIndex = userProfile.inventory.findIndex(invItem => invItem.itemId.equals(itemIdToRemove));

    if (itemIndex > -1) {
        if (userProfile.inventory[itemIndex].quantity > quantityToRemove) {
            userProfile.inventory[itemIndex].quantity -= quantityToRemove;
        } else if (userProfile.inventory[itemIndex].quantity === quantityToRemove) {
            userProfile.inventory.splice(itemIndex, 1); // Remove o item do array
        } else {
            return false; // Não há quantidade suficiente para remover
        }
        return true; // Sucesso
    }
    return false; // Item não encontrado
}

module.exports = { addItemToInventory, removeItemFromInventory };