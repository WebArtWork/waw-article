module.exports = async function(waw) {
	const Schema = waw.mongoose.Schema({
		thumb: String,
		name: String,
		short: String,
		description: String,
		url: { type: String, sparse: true, trim: true, unique: true },
		reference: String,
		isTemplate: Boolean,
 		template: {
			type: waw.mongoose.Schema.Types.ObjectId,
			ref: "Article",
		},
		data: {},
		tag: {
			type: waw.mongoose.Schema.Types.ObjectId,
			ref: 'Tag'
		},
		author: {
			type: waw.mongoose.Schema.Types.ObjectId,
			ref: 'User'
		},
		moderators: [
			{
				type: waw.mongoose.Schema.Types.ObjectId,
				sparse: true,
				ref: 'User'
			}
		]
	});

	Schema.methods.create = function (obj, user, waw) {
		this.author = user._id;

		this.moderators = [user._id];

		this.thumb = obj.thumb;

		this.tag = obj.tag;

		this.url = obj.url;

		this.name = obj.name;

		this.description = obj.description;

		this.reference = obj.reference;

		this.short = obj.short;

		this.data = obj.data;

		this.isTemplate = obj.isTemplate;

		this.template = obj.template;
	}

	return waw.Article = waw.mongoose.model('Article', Schema);
}
