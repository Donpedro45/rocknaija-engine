const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const { extract } = require('article-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser();

app.use(cors());

let cachedNews = [];
let isUpdating = false;

async function updateNewsFeed() {
    if (isUpdating) return;
    isUpdating = true;
    
    try {
        const feedUrls = [
            // Currently only pulling from your original Ghost Desk for AdSense approval
            'https://rocknaija-admin.blogspot.com/feeds/posts/default?alt=rss'
        ];
        
        console.log('[Background Task] Fetching live updates...');

        let allItems = [];
        for (const url of feedUrls) {
            try {
                const feed = await parser.parseURL(url);
                allItems = allItems.concat(feed.items);
            } catch (e) {
                console.log(`[Warning] Could not fetch feed: ${url}`);
            }
        }

        allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // Grabbing the top 20 to fill out your new categories
        const topItems = allItems.slice(0, 20);
        
        const fullArticles = await Promise.all(topItems.map(async (item) => {
            try {
                const articleData = await extract(item.link);
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    author: articleData?.author || 'RockNaija Editorial',
                    content: articleData?.content || item.content || item.description, 
                    description: articleData?.description || item.description || '',
                    image: articleData?.image || null,
                    // Grabbing your Blogger Labels for categorization
                    categories: item.categories || [] 
                };
            } catch (e) {
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    author: 'RockNaija Editorial',
                    content: item.content || item.description,
                    description: item.description || '',
                    image: null,
                    categories: item.categories || []
                };
            }
        }));

        cachedNews = fullArticles;
        console.log('[Background Task] News updated successfully! Ready for instant delivery.');

    } catch (error) {
        console.error('[Background Task Error]', error);
    } finally {
        isUpdating = false;
    }
}

// 1. Tell the engine to grab the news the second it turns on
updateNewsFeed();

// 2. THE SPEED UPGRADE: Automatically update the news every 5 minutes (300,000 milliseconds)
setInterval(updateNewsFeed, 300000);

// 3. The API Endpoint: Hands over the memory box instantly
app.get('/api/news', async (req, res) => {
    try {
        if (cachedNews.length === 0) {
            await updateNewsFeed();
        }
        res.status(200).json({ status: 'success', items: cachedNews });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to deliver dispatches.' });
    }
});

app.listen(PORT, () => console.log(`🚀 RockNaija Cache Engine running on port ${PORT}`));