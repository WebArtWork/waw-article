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
				ensure: async (req, res, next)=>{
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
			ensure: async (req, res, next)  => {
				if(req.body.name) {
					req.body.url = req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '');
					}
				if(req.body.url) {
					while (await waw.Article.count({ url: req.body.url })) {
						const url = req.body.url.split('_');
						req.body.url = url[0] + '_' + (url.length > 1 ? Number(url[1]) + 1 : 1)
					}
				}
				next();
				}
			}
		})
		const seo = {
			title: waw.config.name,
			description: waw.config.description,
			image: 'https://body.webart.work/template/img/logo.png'
	};

	waw.build(template, "articles");
	waw.serve_articles = {};
	const articles = async (req, res) => {
		if (typeof waw.serve_articles[req.get("host")] === "function") {
			waw.serve_articles[req.get("host")](req, res);
		} else {
			const articles = await waw.Article.find(
				req.params.tag_id ? { tag: req.params.tag_id } : {}
			);
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
		}
	};
	waw.app.get("/articles", articles);
	waw.app.get("/articles/:tag_id", articles);

	waw.build(template, "article");
	waw.serve_article = {};
	waw.app.get("/article/:_id", async (req, res) => {
		if (typeof waw.serve_article[req.get("host")] === "function") {
			waw.serve_article[req.get("host")](req, res);
		} else {
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
	});

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
