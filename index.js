const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const activeDrops = new Map();

const commands = [
    new SlashCommandBuilder()
        .setName('drop')
        .setDescription('Crea un drop con botón de claim')
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('El mensaje que aparecerá en el embed')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('hoster')
                .setDescription('La persona que creó el drop')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de drop')
                .setRequired(true)
                .addChoices(
                    { name: 'Botón', value: 'button' },
                    { name: 'Palabra', value: 'word' }
                )
        )
        .addRoleOption(option =>
            option.setName('rol_requerido')
                .setDescription('Rol requerido para participar (opcional)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('palabra')
                .setDescription('Palabra a escribir (solo para tipo palabra)')
                .setRequired(false)
        )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Registrando comandos slash...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('Comandos registrados exitosamente!');
    } catch (error) {
        console.error('Error al registrar comandos:', error);
    }
})();

client.once('ready', () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

function getRandomColor() {
    return Math.floor(Math.random() * 16777215);
}

function generateRandomWord() {
    const words = ['RAPIDO', 'GANA', 'CLAIM', 'DROP', 'SUERTE', 'WIN', 'FAST', 'GO', 'NOW', 'PREMIO'];
    return words[Math.floor(Math.random() * words.length)];
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton()) return;

    if (interaction.isCommand() && interaction.commandName === 'drop') {
        const mensaje = interaction.options.getString('mensaje');
        const hoster = interaction.options.getUser('hoster');
        const tipo = interaction.options.getString('tipo');
        const rolRequerido = interaction.options.getRole('rol_requerido');
        const palabraCustom = interaction.options.getString('palabra');

        if (tipo === 'word' && !palabraCustom) {
            return interaction.reply({
                content: '❌ Debes especificar una palabra cuando el tipo es "word".',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(getRandomColor())
            .setTitle('🎁 Drop Activo')
            .setDescription(mensaje)
            .addFields(
                { name: '👤 Hoster', value: `${hoster}`, inline: true },
                { name: '⏳ Estado', value: 'Esperando...', inline: true }
            );

        if (rolRequerido) {
            embed.addFields({ name: '🎭 Rol Requerido', value: `${rolRequerido}`, inline: true });
        }

        embed.setTimestamp();

        await interaction.channel.send({
            content: '@here',
            allowedMentions: { parse: ['everyone'] }
        });

        await interaction.reply({ 
            embeds: [embed],
            fetchReply: true 
        });

        const message = await interaction.fetchReply();

        setTimeout(async () => {
            if (tipo === 'button') {
                const button = new ButtonBuilder()
                    .setCustomId(`claim_drop_${message.id}`)
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✋');

                const row = new ActionRowBuilder().addComponents(button);

                const updatedEmbed = new EmbedBuilder()
                    .setColor(getRandomColor())
                    .setTitle('🎁 Drop Activo')
                    .setDescription(mensaje)
                    .addFields(
                        { name: '👤 Hoster', value: `${hoster}`, inline: true },
                        { name: '⏳ Estado', value: '¡Haz click en el botón!', inline: true }
                    );

                if (rolRequerido) {
                    updatedEmbed.addFields({ name: '🎭 Rol Requerido', value: `${rolRequerido}`, inline: true });
                }

                updatedEmbed.setTimestamp();

                await message.edit({ 
                    embeds: [updatedEmbed], 
                    components: [row] 
                });

                activeDrops.set(message.id, { rolRequerido });
            } else if (tipo === 'word') {
                const randomWord = palabraCustom.toUpperCase();

                const updatedEmbed = new EmbedBuilder()
                    .setColor(getRandomColor())
                    .setTitle('🎁 Drop Activo')
                    .setDescription(mensaje)
                    .addFields(
                        { name: '👤 Hoster', value: `${hoster}`, inline: true },
                        { name: '⏳ Estado', value: `Escribe: **${randomWord}**`, inline: true }
                    );

                if (rolRequerido) {
                    updatedEmbed.addFields({ name: '🎭 Rol Requerido', value: `${rolRequerido}`, inline: true });
                }

                updatedEmbed.setTimestamp();

                await message.edit({ 
                    embeds: [updatedEmbed]
                });

                activeDrops.set(message.id, { 
                    type: 'word', 
                    word: randomWord, 
                    channelId: interaction.channel.id,
                    rolRequerido,
                    messageId: message.id
                });
            }
        }, 3000);
    }

    if (interaction.isButton() && interaction.customId.startsWith('claim_drop_')) {
        const messageId = interaction.customId.replace('claim_drop_', '');
        const dropData = activeDrops.get(messageId);

        if (!dropData) return;

        if (dropData.rolRequerido) {
            const member = interaction.member;
            if (!member.roles.cache.has(dropData.rolRequerido.id)) {
                return interaction.reply({
                    content: `❌ Necesitas el rol ${dropData.rolRequerido} para participar en este drop.`,
                    ephemeral: true
                });
            }
        }

        const embed = interaction.message.embeds[0];
        
        const disabledButton = ButtonBuilder.from(interaction.message.components[0].components[0])
            .setDisabled(true);

        const row = new ActionRowBuilder().addComponents(disabledButton);

        const winnerEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎉 Drop Reclamado')
            .setDescription(embed.description)
            .addFields(
                { name: '👤 Hoster', value: embed.fields[0].value, inline: true },
                { name: '🏆 Ganador', value: `${interaction.user}`, inline: true }
            )
            .setTimestamp();

        await interaction.update({ 
            embeds: [winnerEmbed], 
            components: [row] 
        });

        await interaction.followUp({ 
            content: `🎊 ¡Felicidades ${interaction.user}! Has ganado el drop.`,
            ephemeral: false 
        });

        activeDrops.delete(messageId);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    for (const [messageId, dropData] of activeDrops.entries()) {
        if (dropData.type === 'word' && 
            message.channel.id === dropData.channelId && 
            message.content.toUpperCase() === dropData.word) {
            
            if (dropData.rolRequerido) {
                const member = message.member;
                if (!member.roles.cache.has(dropData.rolRequerido.id)) {
                    return message.reply({
                        content: `❌ Necesitas el rol ${dropData.rolRequerido} para participar en este drop.`
                    }).then(msg => setTimeout(() => msg.delete(), 5000));
                }
            }

            try {
                const dropMessage = await message.channel.messages.fetch(dropData.messageId);
                const embed = dropMessage.embeds[0];

                const winnerEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎉 Drop Reclamado')
                    .setDescription(embed.description)
                    .addFields(
                        { name: '👤 Hoster', value: embed.fields[0].value, inline: true },
                        { name: '🏆 Ganador', value: `${message.author}`, inline: true }
                    )
                    .setTimestamp();

                await dropMessage.edit({ embeds: [winnerEmbed] });

                await message.channel.send(`🎊 ¡Felicidades ${message.author}! Has ganado el drop escribiendo **${dropData.word}**.`);

                activeDrops.delete(messageId);
            } catch (error) {
                console.error('Error al procesar word drop:', error);
            }
            
            break;
        }
    }
});

client.login(TOKEN);
