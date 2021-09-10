const Augur = require("augurbot"),
  u = require("../utils/utils"),
  moment = require("moment");

const Module = new Augur.Module()
.addEvent("channelCreate", (channel) => {
  try {
    if (channel.guild?.id == Module.config.ldsg) {
      if (channel.permissionsFor(channel.client.user)?.has(["VIEW_CHANNEL", "MANAGE_CHANNELS"])) {
        channel.permissionOverwrites.create(Module.config.roles.muted, {
          // text
          VIEW_CHANNEL: false,
          ADD_REACTIONS: false,
          SEND_MESSAGES: false,
          READ_MESSAGE_HISTORY: false,
          // voice
          CONNECT: false,
          SPEAK: false,
          STREAM: false
        }, { reason: "New channel permissions update" })
        .catch(e => u.errorHandler(e, `Update New Channel Permissions: ${channel.name}`));
      } else {
        u.errorLog.send({ embeds: [
          u.embed({
            title: "Update New Channel Permissions",
            description: `Insufficient permissions to update channel ${channel.name}. Muted permissions need to be applied manually.`
          })
        ] });
      }
    }
  } catch (error) {
    u.errorHandler(error, "Set permissions on channel create");
  }
})
.addEvent("guildBanAdd", (guild, user) => {
  if (guild.id == Module.config.ldsg) {
    if (guild.client.ignoreNotifications?.has(user.id)) {
      guild.client.ignoreNotifications.delete(user.id);
    } else {
      guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({
          author: user,
          title: `${user.username} has been banned`,
          color: 0x0000ff
        })
      ] });
    }
  }
})
.addEvent("guildMemberRemove", async (member) => {
  try {
    if (member.guild.id == Module.config.ldsg) {
      await Module.db.user.updateTenure(member);
      if (!member.client.ignoreNotifications?.has(member.id)) {
        const user = await Module.db.user.fetchUser(member);
        const embed = u.embed({
          author: member,
          title: `${member.displayName} has left the server`,
          color: 0x5865f2,
        })
        .addField("Joined", moment(member.joinedAt).fromNow(), true)
        .addField("Posts", (user?.posts || 0) + " Posts", true);

        member.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [embed] });
      }
    }
  } catch (error) { u.errorHandler(error, `Member Leave: ${u.escapeText(member.displayName)} (${member.id})`); }
})
.addEvent("userUpdate", async (oldUser, newUser) => {
  try {
    const ldsg = newUser.client.guilds.cache.get(Module.config.ldsg);
    const newMember = ldsg.members.cache.get(newUser.id);
    if (newMember && (!newMember.roles.cache.has(Module.config.roles.trusted) || newMember.roles.cache.has(Module.config.roles.untrusted))) {
      const user = await Module.db.user.fetchUser(newMember).catch(u.noop);
      const embed = u.embed({ author: oldUser })
      .setTitle("User Update")
      .setFooter(`${user.posts} Posts in ${moment(newMember?.joinedTimestamp).fromNow(true)}`);
      if (oldUser.tag !== newUser.tag) {
        embed.addField("**Username Update**", `**Old:** ${u.escapeText(oldUser.tag)}\n**New:** ${u.escapeText(newUser.tag)}`);
      }
      if (oldUser.avatar !== newUser.avatar) {
        embed.addField("**Avatar Update**", "See Below").setImage(newUser.displayAvatarURL({ dynamic: true }));
      } else {
        embed.setThumbnail(newUser.displayAvatarURL());
      }
      ldsg.channels.cache.get(Module.config.channels.userupdates).send({ content: `${newUser}: ${newUser.id}`, embeds: [embed] });
    }
  } catch (error) { u.errorHandler(error, `User Update Error: ${u.escapeText(newUser?.username)} (${newUser.id})`); }
});

module.exports = Module;
