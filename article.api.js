module.exports = async (waw) => {
	const ensure = waw.role("admin owner", async (req, res, next) => {
		if (!req.user.is.admin) {
			req.storeIds = (
				await waw.Store.find({
					moderators: req.user._id,
				}).select("_id")
			).map((s) => s.id);
			req.tagsIds = (
				await waw.Tag.find({
					stores: req.storeIds,
				}).select("_id")
			).map((s) => s.id);
		}
		next();
	});
	waw.crud("article", {
		get: {
			ensure,
			query: (req) => {
				return req.user.is.admin
					? {}
					: {
						tags: {
							$in: req.tagsIds,
						},
					};
			},
		},
		update: {
			ensure,
			query: (req) => {
				return req.user.is.admin
					? {
						_id: req.body._id,
					}
					: {
						_id: req.body._id,
						tags: {
							$in: req.tagsIds,
						},
					};
			},
		},
		delete: {
			ensure,
			query: (req) => {
				return req.user.is.admin
					? {
						_id: req.body._id,
					}
					: {
						_id: req.body._id,
						tags: {
							$in: req.tagsIds,
						},
					};
			},
		},
		fetch: {
			ensure,
			query: (req) => {
				return req.user.is.admin
					? {
						_id: req.body._id,
					}
					: {
						_id: req.body._id,
						tags: {
							$in: req.tagsIds,
						},
					};
			},
		},
		create: {
			ensure: async (req, res, next) => {
				if (req.body.name) {
					req.body.url = req.body.name.toLowerCase().replace(/[^a-z0-9]/g, "");
				}
				if (req.body.url) {
					while (await waw.Article.count({ url: req.body.url })) {
						const url = req.body.url.split("_");
						req.body.url =
							url[0] + "_" + (url.length > 1 ? Number(url[1]) + 1 : 1);
					}
				} else {
					delete req.body.url;
				}
				next();
			},
			ensureDomain: async (req, res, next) => {
				req.body.domain = req.get("host");
				next();
			},
		},
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

	const reloads = {};
	waw.addJson(
		"storePrepareArticles",
		async (store, fillJson, req) => {
			reloads[store._id] = reloads[store._id] || [];
			const fillAllArticles = async () => {
				if (!fillJson.tagsIds) {
					return setTimeout(fillAllArticles, 500);
				}

				fillJson.allArticles = await waw.Article.find({
					tags: {
						$in: fillJson.tagsIds,
					},
					enabled: true,
				}).lean();
				for (const article of fillJson.allArticles) {
					article.id = article._id.toString();
					article._id = article._id.toString();
					article.tags = (article.tags || []).map((t) => t.toString());
				}
				fillJson.top_articles = fillJson.allArticles.filter((p) => {
					return p.top;
				});
			};
			fillAllArticles();
			reloads[store._id].push(fillAllArticles);
		},
		"Prepare updatable documents of products"
	);
	const tagsUpdate = async (tag) => {
		setTimeout(() => {
			for (const storeId of tag.stores || []) {
				for (const reload of reloads[storeId] || []) {
					reload();
				}
			}
		}, 2000);
	};
	waw.on("tag_create", tagsUpdate);
	waw.on("tag_update", tagsUpdate);
	waw.on("tag_delete", tagsUpdate);
	const articlesUpdate = async (article) => {
		const tags = await waw.Tag.find({
			_id: article.tags,
		});
		for (const tag of tags) {
			tagsUpdate(tag);
		}
	};
	waw.on("article_create", articlesUpdate);
	waw.on("article_update", articlesUpdate);
	waw.on("article_delete", articlesUpdate);

	/*
	  await waw.wait(2000);
	  if (waw.store_landing) {
		  waw.store_landing.articles = async (query) => {
			  return await waw.articles(query, 4);
		  };
	  }

	  await waw.wait(1000);

	  waw.addJson('operatorArticles', async (operator, fillJson) => {
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
	  }, 'Filling just all article documents');

	  waw.addJson('operatorArticle', async (operator, fillJson, req) => {
		  fillJson.article = await waw.article({
			  domain: operator.domain,
			  _id: req.params._id
		  });

		  fillJson.footer.article = fillJson.article;
	  }, 'Filling just all article documents');


	  waw.addJson('operatorTopArticles', async (operator, fillJson) => {
		  fillJson.topArticles = await waw.articles({
			  domain: operator.domain
		  }, 4);

		  fillJson.footer.topArticles = fillJson.topArticles;
	  }, 'Filling just all article documents');



	  waw.addJson('storeArticles', async (store, fillJson) => {
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
	  }, 'Filling just all article documents');
  */
	const fillTags = (tags, id, fillJson) => {
		for (const tag of tags) {
			if (tag._id === id) {
				tag.active = true;
				fillJson.products = fillJson.allProducts.filter((p) => {
					for (tagId of p.tags) {
						if (tag._id === tagId) {
							return true;
						}
						if (tag.children.includes(tagId)) {
							return true;
						}
					}
					return false;
				});
				tag.tags = fillJson.allTags.filter((t) => {
					return tag._id === t.parent;
				});
			} else if (tag.children.includes(id)) {
				tag.active = true;
				tag.tags = fillJson.allTags.filter((t) => {
					return tag._id === t.parent;
				});
				fillTags(tag.tags, id, fillJson);
			}
		}
	};
	const getTag = (tags) => {
		for (const tag of tags) {
			if (tag.active) {
				return tag;
			}
			if (tag.tags) {
				const innerTag = getTag(tag.tags);
				if (innerTag) {
					return innerTag;
				}
			}
		}
		return false;
	};
	waw.addJson(
		"storeArticle",
		async (store, fillJson, req) => {
			if (!req.params.tag_id) {
				for (const tag of fillJson.tags) {
					tag.tags = [];
					tag.active = false;
				}
			}
			fillJson.article = fillJson.allArticles.find((p) => {
				return p._id === req.params.article_id;
			});
			if (fillJson.article) {
				fillJson.title = fillJson.article.name + " | " + store.name;
			} else {
				// handle no found article
			}
			console.log(req.params, fillJson.article);
		},
		"Add tags and product to json"
	);

	waw.addJson(
		"storeTopArticles",
		async (store, fillJson) => {
			fillJson.topArticles = await waw.articles(
				{
					author: store.author,
				},
				4
			);

			fillJson.footer.topArticles = fillJson.topArticles;
		},
		"Filling just all article documents"
	);
};
