/** 发布成功返回首页时置位，首页 onShow 消费后拉取帖子流（关闭图片预览等不会触发） */
export const HOME_FEED_REFRESH_FLAG = "huasi_refresh_home_feed";

/** 发布成功返回后，「我的发布」页 onShow 消费并重新拉列表 */
export const MY_PUBLISHED_REFRESH_FLAG = "huasi_refresh_my_published";

/** 首页帖子流本地缓存（Pinia store 读写，含版本号便于升级清理） */
export const HOME_FEED_CACHE_KEY = "huasi_home_feed_cache_v1";

/** 商城列表第一页缓存（瀑布流首屏，与接口 pageSize 一致） */
export const MALL_FIRST_PAGE_CACHE_KEY = "huasi_mall_first_page_cache_v1";
