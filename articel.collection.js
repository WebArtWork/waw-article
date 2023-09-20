module.exports = async function(waw) {
	const Schema = waw.mongoose.Schema({
		thumb: String,
		name: String,
		short: String,
		description: String,
		reference: String,
		global: Boolean,
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

		this.name = obj.name;

		this.description = obj.description;

		this.reference = obj.reference;

		this.short = obj.short;

		this.data = obj.data;

		this.global == user.is.admin ? obj.global : false;

		if (user.is.admin && obj.global) {
			this.global = true;
		}
	}

	return waw.Article = waw.mongoose.model('Article', Schema);
}
