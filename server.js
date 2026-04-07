const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const { extract } = require('article-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser();

app.use(cors());

app.get('/api/news', async (req, res) => {
    try {
        // Your Ghost Desk and the Syndicated News are now mixed together
        const feedUrls = [
            'https://rocknaija-admin.blogspot.com/feeds/posts/default?alt=rss',
            'https://feeds.bbci.co.uk/news/world/africa/rss.xml'
        ];
        
        console.log('[Backend] Fetching from all syndication networks...');

        let allItems = [];
        for (const url of feedUrls) {
            try {
                const feed = await parser.parseURL(url);
                allItems = allItems.concat(feed.items);
            } catch (e) {
                console.log(`[Warning] Could not fetch feed: ${url}`);
            }
        }

        // Sort them by newest first, then grab the top 8 total
        allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        const topItems = allItems.slice(0, 8);

        console.log('[Backend] Extracting full text and images...');
        
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

        res.status(200).json({ status: 'success', items: fullArticles });

    } catch (error) {
        console.error('[Backend Error]', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve data.' });
    }
});

app.listen(PORT, () => console.log(`🚀 RockNaija Multi-Source Engine running on port ${PORT}`));