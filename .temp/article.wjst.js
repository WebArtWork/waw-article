import Crud from '/api/wjst/crud';
class Article extends Crud {
	getName = 'public';
	constructor() {
		super('/api/article');
	}
}
export default new Article();
