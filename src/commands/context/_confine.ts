import { Command } from "@sapphire/framework";
import { config, confinementCache, responseCache } from "@src/config";
import {
	ActionRowBuilder,
	ApplicationCommandType,
	GuildMember,
	type MessageComponentInteraction,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	type UserContextMenuCommandInteraction,
} from "discord.js";

export class ConfineCommand extends Command {
	public override async contextMenuRun(
		interaction: UserContextMenuCommandInteraction,
	) {
		try {
			if (
				!interaction.isUserContextMenuCommand
			)
				return;
			if (!interaction.inGuild() || !(interaction.targetMember instanceof GuildMember)) return;
			if (!config.devGuildId && !responseCache.has(interaction.guildId)) return;

			const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder().setCustomId("confinement_time").addOptions(
					new StringSelectMenuOptionBuilder().setLabel('1 hour').setValue('10e3'),
					new StringSelectMenuOptionBuilder().setLabel('1 day').setValue('8.64e7'),
					new StringSelectMenuOptionBuilder().setLabel('1 week').setValue('6.048e8'),
				),
			);

			const res = await interaction.reply({
				components: [row],
				ephemeral: true,
			});

			const collectorFilter = (i: MessageComponentInteraction) =>
				i.user.id === interaction.user.id;
			try {
				const confirmation = await res.awaitMessageComponent({
					filter: collectorFilter,
					time: 10_000,
				});

				if (!confirmation.isStringSelectMenu()) return await res.delete();

				if (confirmation.customId === "confinement_time") {
					await interaction.targetMember.roles.add(responseCache.get(interaction.guildId)?.confinementRole!);

					confinementCache.set(interaction.targetMember.id, {
						id: interaction.targetMember.id,
						guildId: interaction.guildId,
						confinementRole: responseCache.get(interaction.guildId)?.confinementRole!,
						releaseDate: new Date(Date.now() + Number(confirmation.values[0])),
					});

					await res.edit({ content: 'Confined member to configured channel.', components: [] });
				}
			} catch (ex) {
				await res.edit({ content: `Failed to confine member.\n${(ex as Error).message}`, components: [] });
				this.container.logger.error(ex);
			}
		} catch (ex) {
			this.container.logger.error(ex);
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerContextMenuCommand((builder) =>
			builder //
				.setName("Confine to Channel")
				.setType(ApplicationCommandType.User),
		);
	}
}
