const Augur = require("augurbot"),
    u = require("../utils/utils"),
    config = require("../config/config.json"),
    { MessageActionRow, MessageSelectMenu } = require('discord.js'),
    { allColors, getInventory } = require("../utils/roleColors");

//base functions for handling the primary interaction;
async function roleAdd(interaction) {
    interaction.reply({ content: `coming soon`, ephemeral: true });
}
async function roleAssign(interaction) {
    interaction.reply({ content: `coming soon`, ephemeral: true });
}
async function roleRemove(interaction) {
    interaction.reply({ content: `coming soon`, ephemeral: true });
}
/**
 * Sends embeded mentions of equipable color roles.
 * @param {Discord.interaction} interaction 
 */
async function roleInventory(interaction) {
    let member = interaction.member;
    let roles = getInventory(interaction.member)
        .map(color => interaction.guild.roles.cache.get(color))
        .sort((a, b) => b.comparePositionTo(a));
    let embed = u.embed().setAuthor(member.displayName, member.user.displayAvatarURL({ size: 32 }))
        .setTitle("Equippable Color Inventory")
        .setDescription(`Equip a color role by using /role equip \n\n${roles.join("\n")}`);
        let sender = { embeds: [embed], allowed_mentions: { "parse": [] } }
        if(u.botSpam(interaction) == interaction.channel)
            {
                await interaction.reply(sender);
            }
        else u.botSpam(interaction).send(sender);
}
/**
 * Sends embeded mentions and a dropdown menu which allows users to select roles. Role changes are handled in the menu handler.
 * @param {Discord.interaction} interaction 
 */
async function roleEquip(interaction) {
    let member = interaction.member;
    let dropDownOptions = [];
    let roles = getInventory(interaction.member)
        .map(color => {
            let colorRole = interaction.guild.roles.cache.get(color);
            dropDownOptions.push({
                label: colorRole.name,
                value: color,
                position: colorRole.position
            });
            return colorRole;
        })
        .sort((a, b) => b.comparePositionTo(a));
    dropDownOptions.sort((a, b) => b.position - a.position);
    let embed = u.embed().setAuthor(member.displayName, member.user.displayAvatarURL({ size: 32 }))
        .setTitle("Equippable Color Inventory")
        .setDescription(`Equip a color role by using /role equip \n\n${roles.join("\n")}`);

    const SelectMenu = new MessageSelectMenu()
        .setCustomId('RoleColorSelectMenu')
        .setPlaceholder('Choose your color')
        .addOptions(dropDownOptions);
    const row = new MessageActionRow().addComponents(SelectMenu);
    await interaction.reply({ embeds: [embed], allowed_mentions: { "parse": [] }, ephemeral: true, components: [row] });
}
const Module = new Augur.Module();
Module.addInteractionCommand({
    name: "role",
    guildId: config.ldsg,
    commandId: "887044509798629396",
    process: async (interaction) => {
        switch (interaction.options.getSubcommand(true)) {
            case "add":
                await roleAdd(interaction);
                break;
            case "assign":
                await roleAssign(interaction);
                break;
            case "remove":
                await roleRemove(interaction);
                break;
            case "inventory":
                await roleInventory(interaction);
                break;
            case "equip":
                await roleEquip(interaction);
                break;
        }
    }
}).addInteractionHandler({
    name: "Role Color Select Menu",
    customId: "RoleColorSelectMenu",
    process: async (interaction) => {
        const roleId = interaction.values[0];
        const role = interaction.guild.roles.cache.get(roleId);
        await interaction.member.roles.remove(Array.from(allColors.values()));
        await interaction.member.roles.add(role.id);
        interaction.reply({ content: `👌`, ephemeral: true });
    }
});

module.exports = Module;
