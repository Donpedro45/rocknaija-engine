const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const { extract } = require('article-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser();

app.use(cors());

// This is our high-speed "Memory Box"
let cachedNews = [];
let isUpdating = false;

// This function does the heavy lifting quietly in the background
async function updateNewsFeed() {
    if (isUpdating) return;
    isUpdating = true;
    
    try {
        const feedUrls = [
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
        const topItems = allItems.slice(0, 8);
        
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
                    image: articleData?.image || null 
                };
            } catch (e) {
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    author: 'RockNaija Wire',
                    content: item.content || item.description,
                    description: item.description || '',
                    image: null
                };
            }
        }));

        // Quietly update the memory box with the fresh news
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

// 2. Tell the engine to automatically update the news every 30 minutes (1,800,000 milliseconds)
setInterval(updateNewsFeed, 1800000);

// 3. The API Endpoint: Now it just hands over the memory box instantly
app.get('/api/news', async (req, res) => {
    try {
        // If someone visits the exact second the server reboots and the box is empty, wait just a moment
        if (cachedNews.length === 0) {
            await updateNewsFeed();
        }
        
        // Deliver the news instantly
        res.status(200).json({ status: 'success', items: cachedNews });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to deliver dispatches.' });
    }
});

app.listen(PORT, () => console.log(`🚀 RockNaija Cache Engine running on port ${PORT}`));