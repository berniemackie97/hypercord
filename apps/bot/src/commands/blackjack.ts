import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";
import { getEconomy, addBalance, removeBalance, formatCurrency } from "../utils/economy.js";

const optionsSchema = z.object({
  bet: schemas.nonNegativeInt.min(10, "Minimum bet is 10"),
});

const SUITS = ["♠️", "♣️", "♥️", "♦️"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  const deck: string[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push(value + suit);
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function getCardValue(card: string) {
  const value = card.slice(0, -1);
  if (value === "A") return 11;
  if (["J", "Q", "K"].includes(value)) return 10;
  return parseInt(value);
}

function getHandValue(hand: string[]) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    const cardValue = getCardValue(card);
    value += cardValue;
    if (card.startsWith("A")) aces++;
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

const commandData = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Play blackjack and win currency!")
  .addIntegerOption((o) =>
    o.setName("bet").setDescription("Amount to bet").setMinValue(10).setRequired(true)
  );

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(rateLimitMiddleware({ max: 10, window: 60000, scope: "user" }))
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { bet } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    await interaction.deferReply();

    const eco = await getEconomy(interaction.user.id, interaction.guild!.id);

    if (eco.balance < bet) {
      await interaction.editReply({ content: `❌ You don't have enough currency! You need ${formatCurrency(bet)}.` });
      return;
    }

    // Initialize game
    const deck = createDeck();
    const playerHand = [deck.pop()!, deck.pop()!];
    const dealerHand = [deck.pop()!, deck.pop()!];

    const renderGame = (hideDealer = true) => {
      const playerValue = getHandValue(playerHand);
      const dealerValue = getHandValue(dealerHand);

      const embed = new EmbedBuilder()
        .setTitle("🃏 Blackjack")
        .setColor(0x2ecc71)
        .addFields(
          {
            name: `Your Hand (${playerValue})`,
            value: playerHand.join(" "),
            inline: true,
          },
          {
            name: `Dealer's Hand ${hideDealer ? "" : `(${dealerValue})`}`,
            value: hideDealer ? `${dealerHand[0]} ??` : dealerHand.join(" "),
            inline: true,
          },
          {
            name: "Bet",
            value: formatCurrency(bet),
            inline: true,
          }
        )
        .setFooter({ text: interaction.user.tag })
        .setTimestamp();

      return embed;
    };

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Success)
    );

    const message = await interaction.editReply({ embeds: [renderGame()], components: [row] });

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "This isn't your game!", ephemeral: true });
        return;
      }

      if (i.customId === "hit") {
        playerHand.push(deck.pop()!);
        const playerValue = getHandValue(playerHand);

        if (playerValue > 21) {
          collector.stop("bust");
        } else {
          await i.update({ embeds: [renderGame()] });
        }
      } else if (i.customId === "stand") {
        collector.stop("stand");
      }
    });

    collector.on("end", async (_, reason) => {
      const playerValue = getHandValue(playerHand);

      if (reason === "bust") {
        await removeBalance(interaction.user.id, interaction.guild!.id, bet, "blackjack_loss");
        const embed = renderGame(false).setColor(0xe74c3c).setDescription("**You busted! Dealer wins.**");
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      // Dealer's turn
      while (getHandValue(dealerHand) < 17) {
        dealerHand.push(deck.pop()!);
      }

      const dealerValue = getHandValue(dealerHand);
      let result = "";
      let winnings = 0;

      if (dealerValue > 21) {
        result = "**Dealer busted! You win!**";
        winnings = bet;
      } else if (playerValue > dealerValue) {
        result = "**You win!**";
        winnings = bet;
      } else if (playerValue === dealerValue) {
        result = "**Push! It's a tie.**";
      } else {
        result = "**Dealer wins!**";
        winnings = -bet;
      }

      if (winnings > 0) {
        await addBalance(interaction.user.id, interaction.guild!.id, winnings, "blackjack_win");
      } else if (winnings < 0) {
        await removeBalance(interaction.user.id, interaction.guild!.id, Math.abs(winnings), "blackjack_loss");
      }

      const finalEmbed = renderGame(false)
        .setColor(winnings >= 0 ? 0x2ecc71 : 0xe74c3c)
        .setDescription(`${result}\n${winnings > 0 ? `+${formatCurrency(winnings)}` : winnings < 0 ? formatCurrency(winnings) : "No change"}`);

      await interaction.editReply({ embeds: [finalEmbed], components: [] });
    });
  })
  .build();
