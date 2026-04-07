const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const { extract } = require('article-parser'); // The new extraction tool

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser();

app.use(cors());

app.get('/api/news', async (req, res) => {
    try {
        const feedUrl = 'https://feeds.bbci.co.uk/news/world/africa/rss.xml';
        console.log(`[Backend] Fetching live feeds from: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);

        // We only process the top 8 articles at a time so your server doesn't get overloaded
        const topItems = feed.items.slice(0, 8);

        console.log('[Backend] Extracting full text and images. This may take a few seconds...');
        
        // This is the magic part: It visits the actual website and pulls the full content and images
        const fullArticles = await Promise.all(topItems.map(async (item) => {
            try {
                const articleData = await extract(item.link);
                
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    author: articleData?.author || 'RockNaija Wire',
                    // Prioritize the full extracted content
                    content: articleData?.content || item.content || item.description, 
                    description: articleData?.description || item.description || '',
                    // Grab the main image
                    image: articleData?.image || null 
                };
            } catch (e) {
                console.log(`Could not extract full text for ${item.link}, falling back to summary.`);
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

        res.status(200).json({
            status: 'success',
            items: fullArticles
        });

    } catch (error) {
        console.error('[Backend Error]', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve data.' });
    }
});

app.listen(PORT, () => console.log(`🚀 RockNaija Engine running on http://localhost:${PORT}`));