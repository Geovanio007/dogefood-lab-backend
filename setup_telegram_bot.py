#!/usr/bin/env python3
"""
Telegram Bot Setup Script for DogeFood Lab Mini App
"""

import asyncio
import os
from telegram import Bot, BotCommand, MenuButton, MenuButtonWebApp, WebAppInfo
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

TELEGRAM_BOT_TOKEN = "8253212634:AAGZ0Bo0ZD3CcNKyABmMurEMsTclyADCqIE"
WEB_APP_URL = "https://doge-chef.preview.emergentagent.com"

async def setup_bot():
    """Setup the Telegram bot with Mini App configuration"""
    
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    
    try:
        # Get bot info
        bot_info = await bot.get_me()
        print(f"🤖 Bot Info: @{bot_info.username} ({bot_info.first_name})")
        
        # Set bot commands
        commands = [
            BotCommand("start", "🎮 Launch DogeFood Lab game"),
            BotCommand("play", "🧪 Open the laboratory"),
            BotCommand("help", "❓ Get help and instructions"),
        ]
        
        await bot.set_my_commands(commands)
        print("✅ Bot commands set successfully")
        
        # Set the Menu Button to launch the Web App
        menu_button = MenuButtonWebApp(
            text="🧪 Play DogeFood Lab",
            web_app=WebAppInfo(url=WEB_APP_URL)
        )
        
        await bot.set_chat_menu_button(menu_button=menu_button)
        print("✅ Menu button set successfully")
        
        # Set bot description
        description = """🧪 Welcome to DogeFood Lab!

Mix magical ingredients, create amazing treats for Doge, and compete with other scientists!

🎮 Features:
• Create unique treats with different rarities
• Level up your scientist skills
• Compete on the leaderboard
• Earn points and rewards

Tap the menu button or send /start to begin your adventure!"""
        
        await bot.set_my_description(description)
        print("✅ Bot description set successfully")
        
        # Set short description
        short_description = "🧪 DogeFood Lab - Mix, Test & Upgrade Your Way to the Top!"
        await bot.set_my_short_description(short_description)
        print("✅ Bot short description set successfully")
        
        print(f"\n🎉 Bot setup complete!")
        print(f"🔗 Mini App URL: {WEB_APP_URL}")
        print(f"🤖 Bot: @{bot_info.username}")
        print(f"📱 Users can now start the Mini App by messaging your bot!")
        
    except Exception as e:
        print(f"❌ Error setting up bot: {e}")

if __name__ == "__main__":
    asyncio.run(setup_bot())