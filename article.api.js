const path = require("path");
const template = path.join(process.cwd(), "template");

module.exports = async (waw) => {
	waw.crud("article", {
		get: [
			{
				ensure: waw.next,
			},
			{
				name: "public",
				ensure: waw.next,
				query: () => {
					return {};
				}
			},
			{
				name: 'noveltys',
				ensure: waw.next,
				query: () => {
					return {
						isTemplate: true
					};
				}
			},
			{
				name: 'links',
				ensure: async (req, res, next) => {
					if (req.user) {
						req.noveltys_ids = (await waw.Article.find({
							moderators: req.user._id,
							isTemplate: true
						}).select('_id')).map(p => p.id);

						next();
					} else {
						res.json([]);
					}
				},
				query: (req) => {
					return {
						template: {
							$in: req.noveltys_ids
						}
					};
				}
			},
			{
				name: 'admin',
				ensure: waw.role('admin'),
				query: () => {
					return {};
				}
			},
			{
				ensure: waw.next,
				query: req => {
					return { domain: req.get('host') }
				}
			}
		],
		update: {
			query: (req) => {
				if (req.user.is.admin) {
					return {
						_id: req.body._id,
					};
				} else {
					return {
						moderators: req.user._id,
						_id: req.body._id,
					};
				}
			}
		},
		delete: {
			query: (req) => {
				if (req.user.is.admin) {
					return {
						_id: req.body._id,
					};
				} else {
					return {
						moderators: req.user._id,
						_id: req.body._id,
					};
				}
			}
		},
		create: {
			ensure: async (req, res, next) => {
				if (req.body.name) {
					req.body.url = req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '');
				}
				if (!req.body.url) {
					req.body.url = null; 
				} else {
					while (await waw.Article.count({ url: req.body.url })) {
						const url = req.body.url.split('_');
						req.body.url = url[0] + '_' + (url.length > 1 ? Number(url[1]) + 1 : 1)
					}
				}
				next();
			},
			ensureDomain: async (req, res, next) => {
				req.body.domain = req.get('host');
				next();
			}
		}
	})

	const docs = await waw.Article.find({});
	for (const doc of docs) {
		if (!doc.domain) {
			doc.domain = waw.config.land;
			await doc.save();
		}
	}



	waw.serveArticles = async (req, res) => {
		const query = {};
		if (req.params.tag_id) {
			query.tag = req.params.tag_id;
		}
		if (req.get('host') !== waw.config.land) {
			query.domain = req.get('host');
		}
		const articles = await waw.Article.find(query).limit(10);

		res.send(
			waw.render(
				path.join(template, "dist", "articles.html"),
				{
					...waw.config,
					title: waw.config.articleTitle || waw.config.title,
					description:
						waw.config.articleDescription || waw.config.description,
					image: waw.config.articleImage || waw.config.image,
					articles,
					categories: await waw.tag_groups("article"),
				},
				waw.translate(req)
			)
		);
	};

	waw.api({
		domain: waw.config.land,
		template: {
			path: template,
			prefix: "/template",
			pages: "article articles",
		},
		page: {
			"/articles": waw.serveArticles,
			"/articles/:tag_id": waw.serveArticles,
			"/article/:_id": waw.serveArticle
		}
	});
	waw.serveArticle = async (req, res) => {
		const article = await waw.Article.findOne(
			waw.mongoose.Types.ObjectId.isValid(req.params._id)
				? { _id: req.params._id }
				: { url: req.params._id }
		);

		const articles = await waw.Article.find(
			waw.mongoose.Types.ObjectId.isValid(req.params._id)
				? {
					_id: {
						$ne: req.params._id,
					},
				}
				: {}
		).limit(6);

		res.send(
			waw.render(path.join(template, "dist", "article.html"), {
				...waw.config,
				...{ article, articles },
				categories: await waw.tag_groups("article"),
			},
				waw.translate(req)
			)
		);
	}

	waw.operatorArticles = async (operator, fillJson) => {
		fillJson.articles = await waw.articles({
			domain: operator.domain
		});

		fillJson.articlesByTag = [];
		for (const article of fillJson.articles) {
			if (!article.tag) continue;
			const tagObj = fillJson.articlesByTag.find(c => c.id.toString() === article.tag.toString());
			if (tagObj) {
				tagObj.articles.push(article);
			} else {
				const tag = waw.getTag(article.tag);

				fillJson.articlesByTag.push({
					id: article.tag,
					category: tag.category,
					name: tag.name,
					description: tag.description,
					articles: [article]
				})
			}
		}

		fillJson.articlesByCategory = [];
		for (const byTag of fillJson.articlesByTag) {
			const categoryObj = fillJson.articlesByCategory.find(c => c.id.toString() === byTag.category.toString());
			if (categoryObj) {
				categoryObj.tags.push(byTag);

				for (const article of byTag.articles) {
					if (!categoryObj.articles.find(s => s.id === article.id)) {
						categoryObj.articles.push(article)
					}
				}
			} else {
				const category = waw.getCategory(byTag.category);

				fillJson.articlesByCategory.push({
					id: byTag.category,
					name: category.name,
					description: category.description,
					articles: byTag.articles.slice(),
					tags: [byTag]
				})
			}
		}
	}

	waw.operatorArticle = async (operator, fillJson, req) => {
		fillJson.article = await waw.article({
			domain: operator.domain,
			_id: req.params._id
		});

		fillJson.footer.article = fillJson.article;
	}

	waw.operatorTopArticles = async (operator, fillJson) => {
		fillJson.topArticles = await waw.articles({
			domain: operator.domain
		}, 4);

		fillJson.footer.topArticles = fillJson.topArticles;
	}



	waw.storeArticles = async (store, fillJson) => {
		fillJson.articles = await waw.articles({
			author: store.author
		});

		fillJson.articlesByTag = [];
		for (const article of fillJson.articles) {
			if (!article.tag) continue;
			const tagObj = fillJson.articlesByTag.find(c => c.id.toString() === article.tag.toString());
			if (tagObj) {
				tagObj.articles.push(article);
			} else {
				const tag = waw.getTag(article.tag);

				fillJson.articlesByTag.push({
					id: article.tag,
					category: tag.category,
					name: tag.name,
					description: tag.description,
					articles: [article]
				})
			}
		}

		fillJson.articlesByCategory = [];
		for (const byTag of fillJson.articlesByTag) {
			const categoryObj = fillJson.articlesByCategory.find(c => c.id.toString() === byTag.category.toString());
			if (categoryObj) {
				categoryObj.tags.push(byTag);

				for (const article of byTag.articles) {
					if (!categoryObj.articles.find(s => s.id === article.id)) {
						categoryObj.articles.push(article)
					}
				}
			} else {
				const category = waw.getCategory(byTag.category);

				fillJson.articlesByCategory.push({
					id: byTag.category,
					name: category.name,
					description: category.description,
					articles: byTag.articles.slice(),
					tags: [byTag]
				})
			}
		}
	}

	waw.storeArticle = async (store, fillJson, req) => {
		fillJson.article = await waw.article({
			author: store.author,
			_id: req.params._id
		});

		fillJson.footer.article = fillJson.article;
	}

	waw.storeTopArticles = async (store, fillJson) => {
		fillJson.topArticles = await waw.articles({
			author: store.author,
		}, 4);

		fillJson.footer.topArticles = fillJson.topArticles;
	}


	waw.articles = async (query = {}, limit, count = false) => {
		let exe = count
			? waw.Article.countDocuments(query)
			: waw.Article.find(query);
		if (limit) {
			exe = exe.limit(limit);
		}
		exe = exe.sort({ _id: -1 });
		return await exe;
	};
	waw.article = async (query) => {
		return await waw.Article.findOne(query);
	};

	waw.on("article_create", (doc) => {
		if (doc.thumb) {
			waw.save_file(doc.thumb);
		}
	});
	waw.on("article_update", (doc) => {
		if (doc.thumb) {
			waw.save_file(doc.thumb);
		}
	});
	waw.on("article_delete", (doc) => {
		if (doc.thumb) {
			waw.delete_file(doc.thumb);
		}
	});

	await waw.wait(2000);
	if (waw.store_landing) {
		waw.store_landing.articles = async (query) => {
			return await waw.articles(query, 4);
		};
	}
};
