(() => {
  "use strict";

  const STORAGE_KEY = "campus-base-dashboard.v6";
  const CLOUD_CACHE_PREFIX = `${STORAGE_KEY}.cloud.`;
  const CLOUD_MIGRATION_PREFIX = `${STORAGE_KEY}.migrated.`;
  const CAREER_DIRECTIONS_STORAGE_KEY = `${STORAGE_KEY}.career-directions`;
  const DEMO_SEED_VERSION = "dashboard-onboarding-v1";
  const FRIEND_SYNC_STORAGE_KEY = "campus-base-dashboard.friend-sync.v1";
  const LEGACY_STORAGE_KEYS = ["campus-base-dashboard.v5", "campus-base-dashboard.v4", "campus-base-dashboard.v3", "campus-base-dashboard.v2"];
  const DAY = 86_400_000;
  const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
  const AMAP_API_URL = "https://webapi.amap.com/maps?v=2.0";
  const POINT_CLUSTER_MAX_ZOOM = 10.5;
  const POINT_CLUSTER_RADIUS = 54;
  // Offset the nationwide camera toward the north-east so China's outline sits
  // in the clear space between the left feed, top toolbar and right insight rail.
  const RESEARCH_DEFAULT_VIEW = Object.freeze({ center: [108.4, 41.1], zoom: 3.35, pitch: 0, bearing: 0 });
  const FRIEND_COLOR_PALETTE = Object.freeze([
    "#d59b57", "#4f9eaa", "#8c78bd", "#4f9a78",
    "#c56f78", "#668dcc", "#9b8d54", "#b5689a"
  ]);
  const RESEARCH_MAP_STYLE = {
    version: 8,
    projection: { type: "mercator" },
    sources: {
      street: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors"
      },
      chinaBoundary: {
        type: "geojson",
        data: window.CHINA_BOUNDARY_DATA || "./assets/china-boundary.json",
        attribution: "Administrative boundaries © geoBoundaries"
      },
      chinaProvinces: {
        type: "geojson",
        data: window.CHINA_PROVINCE_DATA || "./assets/china-provinces.json"
      }
    },
    layers: [
      {
        id: "map-paper",
        type: "background",
        paint: { "background-color": "#dbe1dc" }
      },
      {
        id: "street-detail",
        type: "raster",
        source: "street",
        paint: {
          "raster-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.88, 5.5, 0.92, 8.5, 0.97, 11, 1],
          "raster-saturation": ["interpolate", ["linear"], ["zoom"], 2, -0.72, 4, -0.64, 6, -0.46, 8, -0.23, 10, -0.07, 12, 0],
          "raster-contrast": ["interpolate", ["linear"], ["zoom"], 2, 0.05, 6, 0.04, 9, 0.02, 12, 0],
          "raster-brightness-min": ["interpolate", ["linear"], ["zoom"], 2, 0.42, 5, 0.34, 7, 0.22, 9, 0.1, 11, 0],
          "raster-brightness-max": ["interpolate", ["linear"], ["zoom"], 2, 0.96, 7, 0.98, 10, 1],
          "raster-fade-duration": 180
        }
      },
      {
        id: "china-territory-tint",
        type: "fill",
        source: "chinaBoundary",
        maxzoom: 7,
        paint: {
          "fill-color": "#6f9387",
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.07, 3, 0.11, 5, 0.05, 7, 0]
        }
      },
      {
        id: "china-province-boundaries",
        type: "line",
        source: "chinaProvinces",
        minzoom: 1,
        maxzoom: 7,
        paint: {
          "line-color": "#c7a36d",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.42, 3, 0.82, 5, 0.58, 7, 0],
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.55, 3, 1.15, 5, 1.3, 7, 0.7]
        }
      },
      {
        id: "china-national-boundary",
        type: "line",
        source: "chinaBoundary",
        minzoom: 1,
        maxzoom: 7,
        paint: {
          "line-color": "#173f37",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.65, 3, 0.94, 5, 0.78, 7, 0],
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.85, 3, 1.7, 5, 1.55, 7, 0.8]
        }
      }
    ]
  };
  const OVERVIEW_MAP_STYLE = {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"],
        tileSize: 256,
        attribution: "Sentinel-2 cloudless © EOX, Copernicus Sentinel data"
      },
      chinaBoundary: {
        type: "geojson",
        data: window.CHINA_BOUNDARY_DATA || "./assets/china-boundary.json"
      },
      chinaProvinces: {
        type: "geojson",
        data: window.CHINA_PROVINCE_DATA || "./assets/china-provinces.json"
      }
    },
    layers: [
      { id: "overview-background", type: "background", paint: { "background-color": "#c8d8d4" } },
      {
        id: "overview-satellite",
        type: "raster",
        source: "satellite",
        paint: {
          "raster-opacity": 0.82,
          "raster-saturation": -0.58,
          "raster-contrast": 0.04,
          "raster-brightness-min": 0.28,
          "raster-brightness-max": 0.94
        }
      },
      {
        id: "overview-territory",
        type: "fill",
        source: "chinaBoundary",
        paint: { "fill-color": "#d6b889", "fill-opacity": 0.08 }
      },
      {
        id: "overview-provinces",
        type: "line",
        source: "chinaProvinces",
        paint: { "line-color": "#e9f0e8", "line-opacity": 0.7, "line-width": 0.8 }
      },
      {
        id: "overview-country",
        type: "line",
        source: "chinaBoundary",
        paint: { "line-color": "#f8f5ea", "line-opacity": 0.94, "line-width": 1.6 }
      }
    ]
  };
  const MAP_TILES = {
    transit: {
      url: "https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png",
      options: {
        maxNativeZoom: 18,
        maxZoom: 19,
        attribution: "Map © MeMoMaps · Data © OpenStreetMap contributors"
      }
    },
    street: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors"
      }
    }
  };

  const statusMeta = {
    screening: { label: "待筛选" },
    pending: { label: "待投递" },
    applied: { label: "已投递" },
    test: { label: "测评 / 笔试" },
    interview: { label: "面试中" },
    offer: { label: "Offer" },
    ended: { label: "已结束" }
  };

  const preferenceMeta = {
    love: { label: "很想去", score: 3 },
    okay: { label: "可接受", score: 2 },
    unsure: { label: "不确定", score: 1 }
  };

  const priorityMeta = {
    high: { label: "高", score: 3 },
    medium: { label: "中", score: 2 },
    low: { label: "低", score: 1 }
  };

  const transitModeMeta = {
    WALK: { label: "步行", className: "walk", palette: ["#c8d8df"] },
    SUBWAY: { label: "地铁", className: "subway", palette: ["#5adfff", "#9e88ff", "#ff78ad", "#52dfb3"] },
    BUS: { label: "公交", className: "bus", palette: ["#ffb85c", "#52dcae", "#ff7f72", "#83a7ff"] },
    METRO_RAIL: { label: "市域铁路", className: "metro-rail", palette: ["#ad8bff", "#5adfff", "#ff78ad"] },
    RAILWAY: { label: "铁路", className: "railway", palette: ["#ff759d", "#b18aff", "#5adfff"] },
    TAXI: { label: "出租车", className: "taxi", palette: ["#55df9f"] },
    TRANSIT: { label: "公共交通", className: "transit", palette: ["#5adfff", "#ffb85c", "#9e88ff"] }
  };

  const routeTravelMeta = {
    transit: {
      title: "公共交通行程",
      eyebrow: "TRANSIT ROUTE",
      submit: "查看公共交通",
      calculating: "正在计算公共交通路线…",
      ready: "起终点已就绪，可以查询公共交通。",
      empty: "这两个地点之间没有查到公共交通方案。",
      color: "#5adfff"
    },
    driving: {
      title: "自驾行程",
      eyebrow: "DRIVING ROUTE",
      submit: "查看自驾路线",
      calculating: "正在计算自驾路线…",
      ready: "起终点已就绪，可以查询自驾路线。",
      empty: "这两个地点之间没有查到可用的自驾路线。",
      color: "#d49c59"
    }
  };

  const accuracyMeta = {
    confirmed: "已确认到办公地点",
    approximate: "大致区域",
    unknown: "地址待确认"
  };

  const eventTypeMeta = {
    assessment: { label: "测评 / 笔试截止", category: "assessment" },
    interview: { label: "面试", category: "interview" },
    application: { label: "投递截止", category: "deadline" },
    material: { label: "材料提交截止", category: "deadline" },
    offer: { label: "Offer 回复截止", category: "offer" }
  };

  const eventCategoryMeta = {
    assessment: { label: "测评 / 笔试" },
    interview: { label: "面试" },
    deadline: { label: "投递 / 材料" },
    offer: { label: "Offer 回复" }
  };

  const roleCategoryRules = [
    { key: "product", label: "产品", pattern: /产品|product/i },
    { key: "analysis", label: "分析", pattern: /商业分析|数据分析|经营分析|业务分析|策略分析|分析师|analytics?/i },
    { key: "research", label: "用研", pattern: /用户研究|用户洞察|市场研究|研究员|research/i },
    { key: "strategy", label: "战略", pattern: /战略|商业策略|行业策略|strategy/i },
    { key: "operations", label: "运营", pattern: /运营|增长|内容|社区|operation|growth/i },
    { key: "marketing", label: "市场", pattern: /市场|品牌|营销|商务|公关|marketing|brand/i },
    { key: "engineering", label: "技术", pattern: /开发|工程师|算法|前端|后端|客户端|测试开发|研发|engineer|developer/i },
    { key: "design", label: "设计", pattern: /设计|视觉|交互|体验|design|ux|ui/i }
  ];
  // Keep role signals on the same high-contrast spectrum as the application funnel.
  const roleChartPalette = ["#d29a61", "#4f9da2", "#8e7eb0", "#62b496", "#395d61", "#c8766d", "#7e9a63", "#b87658"];
  const careerDirectionOptions = [
    "产品经理", "AI 产品", "商业产品", "产品运营", "商业分析", "数据分析",
    "用户研究", "战略运营", "增长运营", "品牌市场", "海外业务", "项目管理",
    "软件研发", "算法", "交互设计", "游戏策划", "咨询", "金融 / 投研",
    "人力资源", "供应链", "销售 / BD"
  ];
  const directionSemanticGroups = [
    { direction: /产品|策划/i, terms: ["产品经理", "产品策划", "产品运营", "策略产品", "商业产品", "平台产品", "ai产品", "aipm", "product manager", "product operation"] },
    { direction: /商业分析|数据分析|分析/i, terms: ["商业分析", "数据分析", "经营分析", "业务分析", "策略分析", "分析师", "business analyst", "data analyst", "analytics", "bi"] },
    { direction: /用户研究|用研|研究/i, terms: ["用户研究", "用户洞察", "体验研究", "市场研究", "用研", "ux research", "user research"] },
    { direction: /战略/i, terms: ["战略", "商业策略", "行业策略", "战略规划", "strategy"] },
    { direction: /运营|增长/i, terms: ["运营", "增长", "内容运营", "社区运营", "用户运营", "活动运营", "operation", "growth"] },
    { direction: /品牌|市场/i, terms: ["品牌", "市场", "营销", "公关", "marketing", "brand", "pr"] },
    { direction: /海外|国际|出海/i, terms: ["海外", "国际化", "出海", "跨境", "全球化", "多语种", "小语种", "语言优势", "global", "international", "overseas", "multilingual"] },
    { direction: /供应链|采购|物流/i, terms: ["供应链", "采购", "物流", "仓储", "供应商", "supply chain", "procurement", "scm"] },
    { direction: /研发|技术|工程|开发/i, terms: ["研发", "开发", "工程师", "前端", "后端", "客户端", "测试开发", "software engineer", "developer"] },
    { direction: /算法|ai|人工智能/i, terms: ["算法", "机器学习", "深度学习", "大模型", "人工智能", "machine learning", "llm"] },
    { direction: /设计|交互|视觉/i, terms: ["设计", "交互", "视觉", "体验设计", "ui", "ux", "designer"] },
    { direction: /项目管理|项目/i, terms: ["项目管理", "项目经理", "项目运营", "project manager", "pmo"] },
    { direction: /游戏/i, terms: ["游戏策划", "系统策划", "数值策划", "关卡策划", "游戏运营", "game designer"] },
    { direction: /咨询/i, terms: ["咨询", "顾问", "consultant", "consulting"] },
    { direction: /金融|投研|投资/i, terms: ["金融", "投研", "投资", "证券", "基金", "行业研究", "investment", "equity research"] },
    { direction: /人力|招聘|hr/i, terms: ["人力资源", "招聘", "组织发展", "hr", "human resources", "talent acquisition"] },
    { direction: /销售|bd|商务/i, terms: ["销售", "商务拓展", "客户经理", "销售运营", "business development", "account manager", "bd"] }
  ];

  // The overview represents city-level distribution, so it must not inherit a bad
  // building coordinate from an individual application. Exact office coordinates
  // remain available in the Research map.
  const overviewCityCenters = {
    北京: [116.4074, 39.9042],
    上海: [121.4737, 31.2304],
    深圳: [114.0579, 22.5431],
    杭州: [120.1551, 30.2741],
    成都: [104.0665, 30.5728],
    广州: [113.2644, 23.1291],
    南京: [118.7969, 32.0603],
    武汉: [114.3054, 30.5931],
    苏州: [120.5853, 31.2989],
    西安: [108.9398, 34.3416],
    天津: [117.2008, 39.0842],
    重庆: [106.5516, 29.563],
    长沙: [112.9388, 28.2282],
    青岛: [120.3826, 36.0671],
    厦门: [118.0894, 24.4798],
    福州: [119.2965, 26.0745],
    济南: [117.1201, 36.6512],
    合肥: [117.2272, 31.8206],
    宁波: [121.5503, 29.8746],
    东莞: [113.7518, 23.0207],
    佛山: [113.1214, 23.0215],
    珠海: [113.5767, 22.2707],
    郑州: [113.6254, 34.7466],
    昆明: [102.8329, 24.8801],
    南昌: [115.8582, 28.6829],
    沈阳: [123.4315, 41.8057],
    大连: [121.6147, 38.914],
    哈尔滨: [126.5349, 45.8038],
    长春: [125.3235, 43.8171],
    太原: [112.5489, 37.8706],
    石家庄: [114.5149, 38.0428],
    南宁: [108.3669, 22.817],
    贵阳: [106.6302, 26.647],
    海口: [110.1983, 20.044],
    三亚: [109.512, 18.252],
    兰州: [103.8343, 36.0611],
    乌鲁木齐: [87.6168, 43.8256],
    西宁: [101.7782, 36.6171],
    银川: [106.2309, 38.4872],
    呼和浩特: [111.7492, 40.8426]
  };

  const overviewProvinceByCity = {
    北京: "北京市", 上海: "上海市", 天津: "天津市", 重庆: "重庆市",
    深圳: "广东省", 广州: "广东省", 东莞: "广东省", 佛山: "广东省", 珠海: "广东省",
    杭州: "浙江省", 宁波: "浙江省", 温州: "浙江省",
    成都: "四川省", 绵阳: "四川省",
    南京: "江苏省", 苏州: "江苏省", 无锡: "江苏省", 常州: "江苏省",
    武汉: "湖北省", 西安: "陕西省", 长沙: "湖南省", 郑州: "河南省",
    济南: "山东省", 青岛: "山东省", 合肥: "安徽省",
    福州: "福建省", 厦门: "福建省", 南昌: "江西省",
    昆明: "云南省", 贵阳: "贵州省", 南宁: "广西壮族自治区",
    海口: "海南省", 三亚: "海南省", 沈阳: "辽宁省", 大连: "辽宁省",
    长春: "吉林省", 哈尔滨: "黑龙江省", 石家庄: "河北省", 太原: "山西省",
    呼和浩特: "内蒙古自治区", 兰州: "甘肃省", 西宁: "青海省", 银川: "宁夏回族自治区",
    乌鲁木齐: "新疆维吾尔自治区", 拉萨: "西藏自治区",
    香港: "香港特别行政区", 澳门: "澳门特别行政区", 台北: "台湾省"
  };

  const obsoleteDemoScheduleMigrations = {
    "demo-tencent:整理二面复盘，准备业务终面": { type: "interview", title: "业务终面", startTime: "14:00", endTime: "15:00" },
    "demo-alibaba:准备产品 Case 与数据分析题": { type: "assessment", title: "在线测评截止", startTime: "23:59", endTime: "" },
    "demo-shanghai:补充英文项目材料": { type: "material", title: "英文项目材料提交截止", startTime: "18:00", endTime: "" },
    "demo-chengdu:确认岗位方向与具体楼栋": null,
    "demo-beijing:向校招群确认具体办公地址": null
  };

  const sampleRecords = [
    {
      id: "demo-tencent",
      company: "腾讯",
      role: "产品策划",
      city: "深圳",
      building: "腾讯滨海大厦",
      address: "广东省深圳市南山区海天二路33号",
      lng: 113.93035,
      lat: 22.52585,
      coordinateSystem: "WGS84",
      placeProvider: "OpenStreetMap",
      providerPlaceId: "W737149477",
      accuracy: "unknown",
      locationPreference: "love",
      priority: "high",
      stage: "interview",
      stageDetail: "终面已约",
      events: [{ id: "event-demo-tencent", type: "interview", title: "业务终面", date: "2026-07-20", startTime: "14:00", endTime: "15:00", completed: false }],
      jdUrl: "",
      notes: "地点与生活偏好很匹配。",
      updatedAt: "2026-07-16",
      timeline: [
        { date: "2026-07-15", label: "进入面试中 · 二面待反馈" },
        { date: "2026-07-04", label: "通过测评 / 笔试" },
        { date: "2026-06-27", label: "已投递" }
      ]
    },
    {
      id: "demo-alibaba",
      company: "阿里巴巴",
      role: "产品经理",
      city: "杭州",
      building: "阿里巴巴西溪园区",
      address: "浙江省杭州市余杭区文一西路969号",
      lng: 120.02127,
      lat: 30.28158,
      coordinateSystem: "WGS84",
      placeProvider: "OpenStreetMap",
      providerPlaceId: "W645135612",
      accuracy: "confirmed",
      locationPreference: "love",
      priority: "high",
      stage: "test",
      stageDetail: "在线测评待完成",
      events: [{ id: "event-demo-alibaba", type: "assessment", title: "在线测评截止", date: "2026-07-19", startTime: "23:59", completed: false }],
      jdUrl: "",
      notes: "园区环境喜欢，需要进一步评估租房与通勤。",
      updatedAt: "2026-07-14",
      timeline: [
        { date: "2026-07-14", label: "进入测评 / 笔试 · 测评已完成" },
        { date: "2026-07-08", label: "已投递" }
      ]
    },
    {
      id: "demo-shanghai",
      company: "星河智能",
      role: "商业分析",
      city: "上海",
      building: "上海中心大厦",
      address: "上海市浦东新区陆家嘴银城中路501号",
      lng: 121.5056,
      lat: 31.2335,
      coordinateSystem: "WGS84",
      placeProvider: "manual",
      providerPlaceId: "",
      accuracy: "confirmed",
      locationPreference: "okay",
      priority: "medium",
      stage: "applied",
      stageDetail: "等待筛选",
      events: [{ id: "event-demo-shanghai", type: "material", title: "英文项目材料提交截止", date: "2026-07-23", startTime: "18:00", completed: false }],
      jdUrl: "",
      notes: "岗位匹配，但要评估生活成本。",
      updatedAt: "2026-07-13",
      timeline: [{ date: "2026-07-13", label: "已投递 · 等待筛选" }]
    },
    {
      id: "demo-chengdu",
      company: "云岚互娱",
      role: "用户研究",
      city: "成都",
      building: "天府软件园 C 区",
      address: "四川省成都市武侯区天华二路81号",
      lng: 104.0674,
      lat: 30.5502,
      coordinateSystem: "WGS84",
      placeProvider: "manual",
      providerPlaceId: "",
      accuracy: "approximate",
      locationPreference: "love",
      priority: "medium",
      stage: "pending",
      stageDetail: "JD 待确认",
      events: [],
      jdUrl: "",
      notes: "城市偏好高，办公楼位置仍需向 HR 确认。",
      updatedAt: "2026-07-12",
      timeline: [{ date: "2026-07-12", label: "加入待投递清单" }]
    },
    {
      id: "demo-beijing",
      company: "北辰科技",
      role: "战略运营",
      city: "北京",
      building: "办公楼待确认",
      address: "北京市海淀区中关村片区",
      lng: null,
      lat: null,
      coordinateSystem: "WGS84",
      placeProvider: "manual",
      providerPlaceId: "",
      accuracy: "unknown",
      locationPreference: "unsure",
      priority: "low",
      stage: "applied",
      stageDetail: "简历筛选中",
      events: [],
      jdUrl: "",
      notes: "不确定具体园区，暂不放置地图 Pin。",
      updatedAt: "2026-07-10",
      timeline: [{ date: "2026-07-10", label: "已投递 · 简历筛选中" }]
    }
  ];

  const byId = (id) => document.getElementById(id);
  const els = {
    dashboard: byId("campus-dashboard"),
    productShell: byId("product-shell"),
    overviewView: byId("overview-view"),
    applicationsView: byId("applications-view"),
    researchView: byId("research-view"),
    appViewButtons: [...document.querySelectorAll("[data-app-view]")],
    appActionButtons: [...document.querySelectorAll("[data-app-action]")],
    toolbar: byId("dashboard-toolbar"),
    entryScreen: byId("entry-screen"),
    entryVideo: document.querySelector(".entry-video"),
    entryAccess: byId("entry-access"),
    enterDashboard: byId("enter-dashboard"),
    enterDemo: byId("enter-demo"),
    entryAuthOpen: byId("entry-auth-open"),
    authPanelClose: byId("auth-panel-close"),
    authSession: byId("auth-session"),
    authSessionEmail: byId("auth-session-email"),
    authTabs: byId("auth-tabs"),
    authLoginTab: byId("auth-login-tab"),
    authRegisterTab: byId("auth-register-tab"),
    authForm: byId("auth-form"),
    authNameField: byId("auth-name-field"),
    authName: byId("auth-name"),
    authInviteField: byId("auth-invite-field"),
    authInvite: byId("auth-invite"),
    authEmailField: byId("auth-email-field"),
    authEmail: byId("auth-email"),
    authPassword: byId("auth-password"),
    authConfirmField: byId("auth-confirm-field"),
    authPasswordConfirm: byId("auth-password-confirm"),
    authSubmit: byId("auth-submit"),
    authReset: byId("auth-reset"),
    authStatus: byId("auth-status"),
    sidebarProfile: byId("sidebar-profile"),
    sidebarAccountLabel: byId("sidebar-account-label"),
    sidebarNav: byId("sidebar-nav"),
    overviewDate: byId("overview-date"),
    overviewPipelineTotal: byId("overview-pipeline-total"),
    overviewPipeline: byId("overview-pipeline"),
    overviewRecent: byId("overview-recent"),
    overviewRoleChart: byId("overview-role-chart"),
    overviewRoleRate: byId("overview-role-rate"),
    overviewRoleSpeed: byId("overview-role-speed"),
    careerDirectionsOpen: byId("career-directions-open"),
    careerDirectionsDialog: byId("career-directions-dialog"),
    careerDirectionsClose: byId("career-directions-close"),
    careerDirectionCloud: byId("career-direction-cloud"),
    careerDirectionCustom: byId("career-direction-custom"),
    careerDirectionCustomAdd: byId("career-direction-custom-add"),
    careerDirectionsStatus: byId("career-directions-status"),
    careerDirectionsSkip: byId("career-directions-skip"),
    careerDirectionsSave: byId("career-directions-save"),
    demoDataClear: byId("demo-data-clear"),
    overviewMapSummary: byId("overview-map-summary"),
    overviewAgenda: byId("overview-agenda"),
    overviewOverdue: byId("overview-overdue"),
    overviewAddButton: byId("overview-add-button"),
    overviewCalendarButton: byId("overview-calendar-button"),
    overviewResearchButton: byId("overview-research-button"),
    applicationsAddButton: byId("applications-add-button"),
    applicationsQuery: byId("applications-query"),
    applicationsStageFilter: byId("applications-stage-filter"),
    applicationsScope: byId("applications-scope"),
    applicationsScopeLabel: byId("applications-scope-label"),
    applicationsScopeClear: byId("applications-scope-clear"),
    applicationsList: byId("applications-list"),
    stageFilter: byId("stage-filter"),
    cityFilter: byId("city-filter"),
    locationFilter: byId("location-filter"),
    mapFilterGroup: byId("map-filter-group"),
    friendFilterField: byId("friend-filter-field"),
    friendFilter: byId("friend-filter"),
    importButton: byId("import-button"),
    importFile: byId("import-file"),
    exportButton: byId("export-button"),
    accountChip: byId("account-chip"),
    accountLabel: byId("account-label"),
    logoutButton: byId("logout-button"),
    friendsButton: byId("friends-button"),
    friendsCount: byId("friends-count"),
    addButton: byId("add-button"),
    pipelineTotal: byId("pipeline-total"),
    stageChart: byId("stage-chart"),
    cityChart: byId("city-chart"),
    deadlineSummary: byId("deadline-summary"),
    deadlineChart: byId("deadline-chart"),
    calendarOpen: byId("calendar-open"),
    calendarDialog: byId("calendar-dialog"),
    calendarClose: byId("calendar-close"),
    calendarPrev: byId("calendar-prev"),
    calendarNext: byId("calendar-next"),
    calendarToday: byId("calendar-today"),
    calendarMonthLabel: byId("calendar-month-label"),
    calendarGrid: byId("calendar-grid"),
    agendaKicker: byId("agenda-kicker"),
    agendaDateLabel: byId("agenda-date-label"),
    agendaList: byId("agenda-list"),
    agendaShowAll: byId("agenda-show-all"),
    eventForm: byId("event-form"),
    eventFormTitle: byId("event-form-title"),
    eventFormError: byId("event-form-error"),
    eventId: byId("event-id"),
    eventJob: byId("event-job"),
    eventType: byId("event-type"),
    eventDate: byId("event-date"),
    eventStartTime: byId("event-start-time"),
    eventEndTime: byId("event-end-time"),
    eventTitle: byId("event-title"),
    eventLocation: byId("event-location"),
    eventNotes: byId("event-notes"),
    eventCancel: byId("event-cancel"),
    eventSave: byId("event-save"),
    missionLeft: byId("mission-left"),
    jobsPanelToggle: byId("jobs-panel-toggle"),
    list: byId("record-list"),
    listCount: byId("list-count"),
    mapCount: byId("map-count"),
    mapLoading: byId("map-loading"),
    mapModeLabel: byId("map-mode-label"),
    mapZoomLabel: byId("map-zoom-label"),
    fitAllButton: byId("fit-all-button"),
    selectionCard: byId("selection-card"),
    routePanel: byId("route-panel"),
    routePanelToggle: byId("route-panel-toggle"),
    routePanelBody: byId("route-panel-body"),
    routeEyebrow: byId("route-eyebrow"),
    routeTitle: byId("route-title"),
    routeModeSwitch: byId("route-mode-switch"),
    routeClose: byId("route-close"),
    routeOrigin: byId("route-origin"),
    routeDestination: byId("route-destination"),
    routeSwap: byId("route-swap"),
    routePicker: byId("route-picker"),
    routePickerTargetLabel: byId("route-picker-target-label"),
    routePlaceQuery: byId("route-place-query"),
    routePlaceSearch: byId("route-place-search"),
    routePickerResults: byId("route-picker-results"),
    routeStatus: byId("route-status"),
    routeSubmit: byId("route-submit"),
    routeResults: byId("route-results"),
    friendsDialog: byId("friends-dialog"),
    friendsClose: byId("friends-close"),
    friendDisplayName: byId("friend-display-name"),
    friendShareCodeWrap: byId("friend-share-code-wrap"),
    friendShareCode: byId("friend-share-code"),
    friendCopyCode: byId("friend-copy-code"),
    friendPublish: byId("friend-publish"),
    friendRevoke: byId("friend-revoke"),
    friendPublishStatus: byId("friend-publish-status"),
    friendCodeInput: byId("friend-code-input"),
    friendAliasInput: byId("friend-alias-input"),
    friendAdd: byId("friend-add"),
    friendRefresh: byId("friend-refresh"),
    friendFollowStatus: byId("friend-follow-status"),
    friendSubscriptions: byId("friend-subscriptions"),
    adminDialog: byId("admin-dialog"),
    adminClose: byId("admin-close"),
    adminRefresh: byId("admin-refresh"),
    adminSummary: byId("admin-summary"),
    adminUserCount: byId("admin-user-count"),
    adminInviteCount: byId("admin-invite-count"),
    adminRouteCount: byId("admin-route-count"),
    adminSearchCount: byId("admin-search-count"),
    adminInviteForm: byId("admin-invite-form"),
    adminInviteCode: byId("admin-invite-code"),
    adminInviteLabel: byId("admin-invite-label"),
    adminInviteMaxUses: byId("admin-invite-max-uses"),
    adminInviteExpiry: byId("admin-invite-expiry"),
    adminInviteCreate: byId("admin-invite-create"),
    adminNewCode: byId("admin-new-code"),
    adminNewCodeValue: byId("admin-new-code-value"),
    adminCopyCode: byId("admin-copy-code"),
    adminStatus: byId("admin-status"),
    adminInviteList: byId("admin-invite-list"),
    adminUsageChart: byId("admin-usage-chart"),
    adminRecentUsage: byId("admin-recent-usage"),
    adminUsersCaption: byId("admin-users-caption"),
    adminUserList: byId("admin-user-list"),
    dialog: byId("job-dialog"),
    form: byId("job-form"),
    formTitle: byId("form-title"),
    formSubtitle: byId("form-subtitle"),
    dialogClose: byId("dialog-close"),
    saveButton: byId("save-button"),
    formError: byId("form-error"),
    jobImportState: byId("job-import-state"),
    jobImportSubmit: byId("job-import-submit"),
    jobImportPaste: byId("job-import-paste"),
    jdSourceText: byId("jd-source-text"),
    jobImportStatus: byId("job-import-status"),
    jobImportReview: byId("job-import-review"),
    jobImportDuplicate: byId("job-import-duplicate"),
    placeQuery: byId("place-query"),
    placeSearchButton: byId("place-search-button"),
    placeResults: byId("place-results"),
    placeSearchStatus: byId("place-search-status"),
    placeProviderChip: byId("place-provider-chip"),
    pickerMapPlaceholder: byId("picker-map-placeholder"),
    company: byId("company"),
    role: byId("role"),
    roleDirection: byId("role-direction"),
    roleDirectionHelp: byId("role-direction-help"),
    stage: byId("stage"),
    stageDetail: byId("stage-detail"),
    city: byId("city"),
    building: byId("building"),
    address: byId("address"),
    accuracy: byId("accuracy"),
    locationPreference: byId("location-preference"),
    lng: byId("lng"),
    lat: byId("lat"),
    priority: byId("priority"),
    jobScheduleAdd: byId("job-schedule-add"),
    jobScheduleList: byId("job-schedule-list"),
    jobScheduleCompose: byId("job-schedule-compose"),
    jobScheduleId: byId("job-schedule-id"),
    jobScheduleType: byId("job-schedule-type"),
    jobScheduleDate: byId("job-schedule-date"),
    jobScheduleStartTime: byId("job-schedule-start-time"),
    jobScheduleEndTime: byId("job-schedule-end-time"),
    jobScheduleTitle: byId("job-schedule-title"),
    jobScheduleLocation: byId("job-schedule-location"),
    jobScheduleNotes: byId("job-schedule-notes"),
    jobScheduleError: byId("job-schedule-error"),
    jobScheduleCancel: byId("job-schedule-cancel"),
    jobScheduleSave: byId("job-schedule-save"),
    jdUrl: byId("jd-url"),
    notes: byId("notes")
  };

  let friendSyncSettings = loadFriendSyncSettings();
  let friendPoints = [];
  let friendMarkers = new Map();
  let friendPublishTimer = null;
  let records = loadRecords();
  let supabaseClient = null;
  let authUser = null;
  let plannedRoleDirections = [];
  let draftRoleDirections = [];
  let authMode = "login";
  let authPanelOpen = false;
  let platformAdmin = false;
  let showcaseDemoActive = false;
  let showcaseDemoSnapshot = null;
  let cloudHydrated = false;
  let cloudHydrationPromise = null;
  let cloudSyncTimer = null;
  let cloudSyncChain = Promise.resolve();
  let adminSnapshot = null;
  let lastCreatedInviteCode = "";
  let selectedId = records[0]?.id || null;
  let selectionCardHidden = true;
  let editingId = null;
  let jobDialogMode = "full";
  let draftJobSnapshot = null;
  let draftJobImportResult = null;
  let draftDuplicateRecords = [];
  let mainMap = null;
  let mainMapReady = false;
  let overviewMap = null;
  let overviewMapReady = false;
  let overviewMapMarkers = [];
  let currentAppView = "overview";
  let applicationsFunnelStages = null;
  let applicationsFunnelLabel = "";
  let applicationsRoleCategory = "";
  let applicationsRoleLabel = "";
  let applicationsScrollBeforeEdit = null;
  let chinaFocusPending = false;
  let mainMarkers = new Map();
  let pointClusterGroups = new Map();
  let pointClusterUpdateFrame = null;
  let routeOrigin = null;
  let routeDestination = null;
  let routeTravelMode = "transit";
  let routePickerTarget = "destination";
  let routePickerOptions = [];
  let routePlans = [];
  let selectedRoutePlanIndex = 0;
  let jobsPanelCollapsed = true;
  let jobsCollapsedBeforeRoute = false;
  let routePanelCollapsed = false;
  let routePlaceSearchTimer = null;
  let routePlaceSearchController = null;
  let routePlaceSearchRequestId = 0;
  let pickerMap = null;
  let pickerMapReady = false;
  let pickerMarker = null;
  let pickerProvider = "leaflet";
  let pickerMapPromise = null;
  let amapLoadPromise = null;
  let searchResults = [];
  let selectedPlaceIndex = -1;
  let draftPlaceMeta = null;
  let searchTimer = null;
  let searchController = null;
  let searchRequestId = 0;
  let calendarCursor = parseDate(today());
  calendarCursor.setDate(1);
  let calendarSelectedDate = today();
  let calendarAgendaMode = "all";
  let calendarFocusedEventRef = null;
  let calendarTriggerElement = null;
  let calendarClosingTimer = null;
  let editingEventRef = null;
  let draftJobEvents = [];
  let editingJobScheduleId = null;
  const searchCache = new Map();
  const systemSelectRegistry = new Map();

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function today() {
    const value = new Date();
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateOffset(offset) {
    const value = new Date();
    value.setHours(12, 0, 0, 0);
    value.setDate(value.getDate() + offset);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function createOnboardingDemoRecords() {
    const eventOffsets = [1, 2, 4, null, null];
    const updatedOffsets = [-1, -2, -3, -4, -5];
    return sampleRecords.map((record, index) => normalizeRecord({
      ...record,
      isDemo: true,
      demoSeedVersion: DEMO_SEED_VERSION,
      updatedAt: dateOffset(updatedOffsets[index]),
      jdUrl: index === 1 ? "https://campus.alibaba.com/" : record.jdUrl,
      events: (record.events || []).map((event) => ({
        ...event,
        date: dateOffset(eventOffsets[index]),
        location: index === 0 ? "https://meeting.tencent.com/" : (index === 1 ? "https://campus.alibaba.com/" : event.location || "")
      })),
      timeline: (record.timeline || []).map((item, itemIndex) => ({
        ...item,
        date: dateOffset(updatedOffsets[index] - itemIndex * 5)
      }))
    }));
  }

  function sanitizeCareerDirections(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .map((value) => value.slice(0, 16)))]
      .slice(0, 8);
  }

  function careerDirectionsStorageKey() {
    return authUser ? `${CAREER_DIRECTIONS_STORAGE_KEY}.${authUser.id}` : CAREER_DIRECTIONS_STORAGE_KEY;
  }

  function loadCareerDirections() {
    const cloudValues = sanitizeCareerDirections(authUser?.user_metadata?.career_directions);
    if (cloudValues.length) return cloudValues;
    try {
      return sanitizeCareerDirections(JSON.parse(localStorage.getItem(careerDirectionsStorageKey()) || "[]"));
    } catch (error) {
      return [];
    }
  }

  function storeCareerDirectionsLocally(values) {
    if (showcaseDemoActive) return;
    try { localStorage.setItem(careerDirectionsStorageKey(), JSON.stringify(values)); } catch (error) { /* no-op */ }
  }

  function renderCareerDirectionCloud() {
    if (!els.careerDirectionCloud) return;
    const values = [...careerDirectionOptions, ...draftRoleDirections.filter((value) => !careerDirectionOptions.includes(value))];
    els.careerDirectionCloud.innerHTML = values.map((value, index) => {
      const selected = draftRoleDirections.includes(value);
      const size = ["is-medium", "is-small", "is-large", "is-small", "is-medium"][index % 5];
      const custom = !careerDirectionOptions.includes(value);
      return `<button class="career-direction-bubble ${size}${selected ? " is-selected" : ""}${custom ? " is-custom" : ""}" type="button" data-career-direction="${escapeHtml(value)}" aria-pressed="${selected}">${escapeHtml(value)}${custom ? "<span aria-hidden=\"true\">×</span>" : ""}</button>`;
    }).join("");
    const remaining = 8 - draftRoleDirections.length;
    els.careerDirectionsStatus.textContent = draftRoleDirections.length
      ? `已选择 ${draftRoleDirections.length} 个方向${remaining ? `，还可以选择 ${remaining} 个。` : "，已达到上限。"}`
      : "最多选择 8 个方向，之后随时可以调整。";
    els.careerDirectionsStatus.dataset.state = draftRoleDirections.length ? "active" : "";
  }

  function openCareerDirections() {
    draftRoleDirections = [...plannedRoleDirections];
    els.careerDirectionCustom.value = "";
    renderCareerDirectionCloud();
    if (typeof els.careerDirectionsDialog.showModal === "function") els.careerDirectionsDialog.showModal();
    else els.careerDirectionsDialog.setAttribute("open", "");
  }

  function closeCareerDirections() {
    if (typeof els.careerDirectionsDialog.close === "function") els.careerDirectionsDialog.close();
    else els.careerDirectionsDialog.removeAttribute("open");
  }

  function addCustomCareerDirection() {
    const value = sanitizeCareerDirections([els.careerDirectionCustom.value])[0] || "";
    if (!value) {
      els.careerDirectionsStatus.textContent = "先输入一个岗位方向。";
      els.careerDirectionsStatus.dataset.state = "error";
      els.careerDirectionCustom.focus();
      return;
    }
    if (!draftRoleDirections.includes(value) && draftRoleDirections.length >= 8) {
      els.careerDirectionsStatus.textContent = "最多选择 8 个方向，请先取消一个再添加。";
      els.careerDirectionsStatus.dataset.state = "error";
      return;
    }
    if (!draftRoleDirections.includes(value)) draftRoleDirections.push(value);
    els.careerDirectionCustom.value = "";
    renderCareerDirectionCloud();
  }

  async function saveCareerDirections() {
    plannedRoleDirections = sanitizeCareerDirections(draftRoleDirections);
    storeCareerDirectionsLocally(plannedRoleDirections);
    els.careerDirectionsSave.disabled = true;
    try {
      if (supabaseClient && authUser) {
        const { data, error } = await supabaseClient.auth.updateUser({
          data: { ...(authUser.user_metadata || {}), career_directions: plannedRoleDirections }
        });
        if (error) throw error;
        if (data?.user) authUser = data.user;
      }
      closeCareerDirections();
      renderOverviewRoleSignals();
    } catch (error) {
      els.careerDirectionsStatus.textContent = "方向已保存在当前设备，云端同步暂时失败。";
      els.careerDirectionsStatus.dataset.state = "error";
    } finally {
      els.careerDirectionsSave.disabled = false;
    }
  }

  function clearDemoRecords() {
    if (showcaseDemoActive) {
      exitShowcaseDemo();
      return;
    }
    const demoCount = records.filter((record) => record.isDemo).length;
    if (!demoCount) return;
    records = records.filter((record) => !record.isDemo);
    selectedId = records[0]?.id || null;
    saveRecords();
    render();
  }

  function makeId() {
    return `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function makeEventId() {
    return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function inferEventType(stage) {
    if (stage === "test") return "assessment";
    if (stage === "interview") return "interview";
    if (stage === "offer") return "offer";
    return "application";
  }

  function normalizeEvent(event, fallbackId = null) {
    const type = eventTypeMeta[event?.type] ? event.type : "application";
    return {
      id: event?.id || fallbackId || makeEventId(),
      type,
      title: String(event?.title || eventTypeMeta[type].label).trim(),
      date: String(event?.date || "").trim(),
      startTime: String(event?.startTime || "").trim(),
      endTime: String(event?.endTime || "").trim(),
      location: String(event?.location || "").trim(),
      notes: String(event?.notes || "").trim(),
      completed: Boolean(event?.completed),
      source: String(event?.source || "manual"),
      createdAt: String(event?.createdAt || today())
    };
  }

  function normalizeStoredEvent(event, recordId) {
    if (!event || event.source === "legacyNext" || event.type === "followup") return null;
    const migrationKey = `${recordId}:${String(event.title || "").trim()}`;
    if (Object.prototype.hasOwnProperty.call(obsoleteDemoScheduleMigrations, migrationKey)) {
      const migration = obsoleteDemoScheduleMigrations[migrationKey];
      return migration ? normalizeEvent({ ...event, ...migration }) : null;
    }
    return eventTypeMeta[event.type] ? normalizeEvent(event) : null;
  }

  function normalizeJdSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return null;
    const normalizeField = (rawField) => {
      const raw = rawField && typeof rawField === "object" ? rawField : { value: rawField };
      return {
        value: String(raw?.value || "").trim().slice(0, 180),
        confidence: ["high", "medium", "low"].includes(raw?.confidence) ? raw.confidence : "low",
        source: String(raw?.source || "unknown").slice(0, 24)
      };
    };
    const fields = snapshot.fields && typeof snapshot.fields === "object" ? snapshot.fields : {};
    return {
      version: 1,
      sourceUrl: String(snapshot.sourceUrl || "").trim().slice(0, 1200),
      mode: snapshot.mode === "text" ? "text" : "url",
      capturedAt: String(snapshot.capturedAt || "").slice(0, 40),
      contentHash: String(snapshot.contentHash || "").slice(0, 128),
      pageTitle: String(snapshot.pageTitle || "").trim().slice(0, 240),
      text: String(snapshot.text || "").trim().slice(0, 12_000),
      fields: {
        company: normalizeField(fields.company),
        role: normalizeField(fields.role),
        city: normalizeField(fields.city),
        deadline: normalizeField(fields.deadline),
        officeQuery: normalizeField(fields.officeQuery),
        direction: normalizeField(fields.direction)
      }
    };
  }

  function normalizeRecord(record) {
    const id = record.id || makeId();
    const normalized = {
      coordinateSystem: "WGS84",
      placeProvider: "manual",
      providerPlaceId: "",
      providerCoordinateSystem: "WGS84",
      providerLng: null,
      providerLat: null,
      accuracy: "unknown",
      locationPreference: "unsure",
      priority: "medium",
      stage: "pending",
      stageDetail: "",
      roleDirection: "",
      jdUrl: "",
      jdSnapshot: null,
      notes: "",
      timeline: [],
      events: [],
      ...record,
      id,
      isDemo: Boolean(record.isDemo || String(id).startsWith("demo-")),
      timeline: Array.isArray(record.timeline) ? record.timeline : []
    };
    normalized.roleDirection = String(record.roleDirection || "").trim().replace(/\s+/g, " ").slice(0, 16);
    normalized.jdSnapshot = normalizeJdSnapshot(record.jdSnapshot);
    const storedEvents = Array.isArray(record.events)
      ? record.events
          .map((event) => normalizeStoredEvent(event, id))
          .filter((event) => event?.date)
      : [];
    normalized.events = storedEvents;
    delete normalized.nextAction;
    delete normalized.nextDate;
    return normalized;
  }

  function readStoredRecords(keys) {
    for (const key of keys) {
      try {
        const stored = localStorage.getItem(key);
        if (stored === null) continue;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return { key, records: parsed.map(normalizeRecord) };
      } catch (error) {
        // The dashboard remains usable in memory if storage is unavailable.
      }
    }
    return null;
  }

  function loadRecords() {
    const stored = readStoredRecords([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
    if (stored) return stored.records;
    return createOnboardingDemoRecords();
  }

  function activeRecordStorageKey() {
    return authUser ? `${CLOUD_CACHE_PREFIX}${authUser.id}` : STORAGE_KEY;
  }

  function saveRecords() {
    if (showcaseDemoActive) return;
    try {
      localStorage.setItem(activeRecordStorageKey(), JSON.stringify(records));
    } catch (error) {
      // Export remains available as a backup when local storage is unavailable.
    }
    if (supabaseClient && authUser && cloudHydrated) scheduleCloudSync();
    if (friendSyncSettings?.mySpace?.code && (friendSyncSettings.mySpace.ownerToken || (supabaseClient && authUser))) scheduleOwnPointPublish();
  }

  function supabaseConfiguration() {
    const config = window.SUPABASE_CONFIG || {};
    return {
      url: String(config.url || "").trim(),
      anonKey: String(config.anonKey || config.publishableKey || "").trim()
    };
  }

  function setAuthStatus(message = "", state = "") {
    els.authStatus.textContent = message;
    if (state) els.authStatus.dataset.state = state;
    else delete els.authStatus.dataset.state;
  }

  function setAccountState(state, label) {
    els.accountChip.dataset.state = state;
    els.accountLabel.textContent = label;
    if (els.sidebarAccountLabel) els.sidebarAccountLabel.textContent = label;
  }

  function isPlatformAdmin() {
    return Boolean(authUser && platformAdmin);
  }

  async function hydratePlatformAdminState() {
    platformAdmin = false;
    if (!supabaseClient || !authUser) return;
    const { data, error } = await supabaseClient.rpc("is_platform_admin");
    if (!error) platformAdmin = data === true;
  }

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function authRedirectUrl() {
    return /^https?:$/.test(window.location.protocol) ? `${window.location.origin}${window.location.pathname}` : undefined;
  }

  function friendlyAuthError(error) {
    const message = String(error?.message || "The account service is temporarily unavailable.");
    const known = [
      [/invalid login credentials/i, "The email or password is incorrect."],
      [/email not confirmed/i, "Confirm your email before signing in."],
      [/user already registered/i, "This email is already registered. You can sign in instead."],
      [/valid invite code is required/i, "Enter a valid invite code to create an account."],
      [/invite code is invalid|invite code.*inactive|invite code.*expired|fully used/i, "This invite code is invalid, inactive, expired, or fully used."],
      [/password should be at least/i, "Your password must contain at least 8 characters."],
      [/rate limit/i, "Too many attempts. Try again in a moment."],
      [/failed to fetch/i, "We could not reach the account service. Check your connection and try again."]
    ];
    return known.find(([pattern]) => pattern.test(message))?.[1] || message;
  }

  function setAuthMode(mode) {
    authMode = ["login", "register", "recovery"].includes(mode) ? mode : "login";
    const registering = authMode === "register";
    const recovering = authMode === "recovery";
    els.authLoginTab.setAttribute("aria-selected", String(authMode === "login"));
    els.authRegisterTab.setAttribute("aria-selected", String(registering));
    els.authTabs.hidden = recovering;
    els.authNameField.hidden = !registering;
    els.authInviteField.hidden = !registering;
    els.authEmailField.hidden = recovering;
    els.authConfirmField.hidden = !registering && !recovering;
    els.authName.required = registering;
    els.authEmail.disabled = recovering;
    els.authPasswordConfirm.required = registering || recovering;
    els.authPassword.autocomplete = authMode === "login" ? "current-password" : "new-password";
    els.authPasswordConfirm.autocomplete = "new-password";
    els.authSubmit.textContent = registering ? "Create account" : recovering ? "Save new password" : "Sign in and continue";
    els.authReset.hidden = authMode !== "login";
    els.entryScreen.classList.toggle("is-auth-mode", authPanelOpen || recovering);
  }

  function openAuthPanel(mode = "login") {
    authPanelOpen = true;
    setAuthMode(mode);
    renderAuthState();
    window.requestAnimationFrame(() => {
      if (mode === "register") els.authName.focus({ preventScroll: true });
      else els.authEmail.focus({ preventScroll: true });
    });
  }

  function closeAuthPanel() {
    if (authMode === "recovery") return;
    authPanelOpen = false;
    setAuthStatus();
    renderAuthState();
    els.enterDashboard.focus({ preventScroll: true });
  }

  let entryVideoRetryTimer = 0;
  let entryVideoRetryCount = 0;

  function clearEntryVideoRetry() {
    window.clearTimeout(entryVideoRetryTimer);
    entryVideoRetryTimer = 0;
  }

  function scheduleEntryVideoRetry() {
    const video = els.entryVideo;
    if (!video || !video.paused || document.hidden || els.entryScreen.hidden || entryVideoRetryTimer || entryVideoRetryCount >= 20) return;
    entryVideoRetryTimer = window.setTimeout(() => {
      entryVideoRetryTimer = 0;
      entryVideoRetryCount += 1;
      playEntryVideo();
    }, 350);
  }

  function playEntryVideo() {
    const video = els.entryVideo;
    if (!video || els.entryScreen.hidden || document.hidden) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.controls = false;
    const playback = video.play();
    if (!playback?.then) {
      scheduleEntryVideoRetry();
      return;
    }
    playback.then(() => {
      entryVideoRetryCount = 0;
      clearEntryVideoRetry();
    }).catch(scheduleEntryVideoRetry);
  }

  function initializeEntryVideo() {
    const video = els.entryVideo;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.controls = false;
    video.disablePictureInPicture = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    ["loadedmetadata", "loadeddata", "canplay", "canplaythrough"].forEach((eventName) => video.addEventListener(eventName, playEntryVideo, { passive: true }));
    video.addEventListener("playing", () => {
      entryVideoRetryCount = 0;
      clearEntryVideoRetry();
    }, { passive: true });
    video.addEventListener("pause", scheduleEntryVideoRetry, { passive: true });
    video.addEventListener("stalled", scheduleEntryVideoRetry, { passive: true });
    window.addEventListener("pageshow", playEntryVideo);
    document.addEventListener("visibilitychange", playEntryVideo);
    document.addEventListener("pointerdown", playEntryVideo, { once: true, passive: true });
    playEntryVideo();
  }

  function showEntryScreen() {
    els.entryScreen.hidden = false;
    els.entryScreen.classList.remove("is-leaving");
    els.entryScreen.setAttribute("aria-hidden", "false");
    els.dashboard.classList.remove("is-entered");
    playEntryVideo();
  }

  function renderAuthState() {
    const configured = Boolean(supabaseClient);
    if (!configured) {
      els.authTabs.hidden = true;
      els.authForm.hidden = true;
      els.authSession.hidden = true;
      els.enterDashboard.hidden = false;
      els.enterDemo.hidden = false;
      els.enterDashboard.querySelector("span").textContent = "Open local workspace";
      els.entryAuthOpen.textContent = "Open workspace";
      els.authPanelClose.hidden = true;
      els.logoutButton.hidden = true;
      els.entryScreen.classList.remove("is-auth-mode");
      els.sidebarProfile.disabled = true;
      els.sidebarProfile.classList.remove("is-admin");
      setAccountState("local", "本地模式");
      setAuthStatus("Cloud sync is not configured. Your workspace will remain on this device.");
      return;
    }

    if (authMode === "recovery") {
      els.authSession.hidden = true;
      els.authForm.hidden = false;
      els.enterDashboard.hidden = true;
      els.enterDemo.hidden = true;
      els.authPanelClose.hidden = true;
      els.logoutButton.hidden = true;
      els.sidebarProfile.disabled = true;
      els.sidebarProfile.classList.remove("is-admin");
      authPanelOpen = true;
      setAuthMode("recovery");
      setAccountState("syncing", "重设密码");
      return;
    }

    if (!authUser) {
      els.authSession.hidden = true;
      setAuthMode(authMode === "register" ? "register" : "login");
      els.authTabs.hidden = !authPanelOpen;
      els.authForm.hidden = !authPanelOpen;
      els.enterDashboard.hidden = authPanelOpen;
      els.enterDemo.hidden = authPanelOpen;
      els.enterDashboard.querySelector("span").textContent = "Start organizing";
      els.entryAuthOpen.textContent = "Sign in";
      els.authPanelClose.hidden = !authPanelOpen;
      els.logoutButton.hidden = true;
      els.sidebarProfile.disabled = true;
      els.sidebarProfile.classList.remove("is-admin");
      els.entryScreen.classList.toggle("is-auth-mode", authPanelOpen);
      setAccountState("local", "未登录");
      return;
    }

    authPanelOpen = false;
    els.authTabs.hidden = true;
    els.authForm.hidden = true;
    els.authSession.hidden = false;
    els.authSessionEmail.textContent = authUser.email || "Signed-in account";
    els.enterDashboard.hidden = false;
    els.enterDemo.hidden = true;
    els.enterDashboard.querySelector("span").textContent = "Open workspace";
    els.entryAuthOpen.textContent = "Open workspace";
    els.authPanelClose.hidden = true;
    els.logoutButton.hidden = false;
    els.sidebarProfile.disabled = !isPlatformAdmin();
    els.sidebarProfile.classList.toggle("is-admin", isPlatformAdmin());
    els.sidebarProfile.setAttribute("aria-label", isPlatformAdmin() ? "打开访问控制与用量管理" : "当前账户");
    els.entryScreen.classList.remove("is-auth-mode");
    setAccountState(cloudHydrated ? "cloud" : "syncing", cloudHydrated ? (authUser.email || "云端账户") : "正在同步");
  }

  function scheduleCloudSync() {
    if (!supabaseClient || !authUser || !cloudHydrated) return;
    window.clearTimeout(cloudSyncTimer);
    setAccountState("syncing", "等待同步");
    cloudSyncTimer = window.setTimeout(() => {
      cloudSyncChain = cloudSyncChain.then(() => syncCloudRecords(), () => syncCloudRecords());
    }, 550);
  }

  async function syncCloudRecords() {
    if (!supabaseClient || !authUser || !cloudHydrated) return false;
    setAccountState("syncing", "正在同步");
    const payload = records.map((record) => ({ ...record, events: (record.events || []).map((event) => ({ ...event })) }));
    const { error } = await supabaseClient.rpc("replace_my_dashboard", { payload });
    if (error) {
      setAccountState("error", "同步失败");
      return false;
    }
    setAccountState("cloud", authUser.email || "云端账户");
    return true;
  }

  async function hydrateCloudRecords() {
    if (!supabaseClient || !authUser) return;
    cloudHydrated = false;
    setAccountState("syncing", "正在读取");
    const { data, error } = await supabaseClient
      .from("jobs")
      .select("id,data,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      const cached = readStoredRecords([`${CLOUD_CACHE_PREFIX}${authUser.id}`]);
      if (cached) records = cached.records;
      setAccountState("error", "云端未就绪");
      setAuthStatus("账户已登录，但数据库结构尚未安装；当前保留本地数据。", "error");
      selectedId = records[0]?.id || null;
      render();
      return;
    }

    let shouldMigrate = false;
    let shouldSeedDemo = false;
    if (Array.isArray(data) && data.length) {
      records = data.map((row) => normalizeRecord({ ...(row.data || {}), id: row.id }));
    } else {
      const userCache = readStoredRecords([`${CLOUD_CACHE_PREFIX}${authUser.id}`]);
      const migrationKey = `${CLOUD_MIGRATION_PREFIX}${authUser.id}`;
      const localSource = localStorage.getItem(migrationKey) ? null : readStoredRecords([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
      if (userCache) records = userCache.records;
      else if (localSource) {
        records = localSource.records;
        shouldMigrate = true;
      } else if (authUser.user_metadata?.dashboard_demo_seed_version !== DEMO_SEED_VERSION) {
        records = createOnboardingDemoRecords();
        shouldSeedDemo = true;
      } else records = [];
    }

    selectedId = records[0]?.id || null;
    cloudHydrated = true;
    try {
      localStorage.setItem(`${CLOUD_CACHE_PREFIX}${authUser.id}`, JSON.stringify(records));
    } catch (error) {
      // Cloud data remains available if the browser cache is unavailable.
    }
    render();

    if (shouldMigrate) {
      setAuthStatus(`正在把本机的 ${records.length} 条岗位记录迁移到云端…`);
      const migrated = await syncCloudRecords();
      if (migrated) {
        try { localStorage.setItem(`${CLOUD_MIGRATION_PREFIX}${authUser.id}`, new Date().toISOString()); } catch (error) { /* no-op */ }
        setAuthStatus(`已把 ${records.length} 条本地记录迁移到当前账户。`, "success");
      }
    } else if (shouldSeedDemo) {
      setAuthStatus("正在准备你的示例工作区…");
      const seeded = await syncCloudRecords();
      if (seeded) {
        const { data } = await supabaseClient.auth.updateUser({
          data: { ...(authUser.user_metadata || {}), dashboard_demo_seed_version: DEMO_SEED_VERSION }
        });
        if (data?.user) authUser = data.user;
        setAuthStatus("示例岗位已就绪；可随时清空并开始记录。", "success");
      }
    } else {
      setAccountState("cloud", authUser.email || "云端账户");
      setAuthStatus("云端数据已连接。", "success");
    }
  }

  async function handleAuthenticatedSession(session, { enter = false } = {}) {
    if (!session?.user) return;
    const userChanged = authUser?.id !== session.user.id;
    authUser = session.user;
    showcaseDemoActive = false;
    showcaseDemoSnapshot = null;
    await hydratePlatformAdminState();
    plannedRoleDirections = loadCareerDirections();
    if (userChanged) {
      friendSyncSettings = loadFriendSettingsForUser(authUser.id);
      rebuildFriendPointsFromCache();
    }
    authMode = "login";
    renderAuthState();
    if (userChanged || !cloudHydrated) {
      if (!cloudHydrationPromise) {
        cloudHydrationPromise = hydrateCloudRecords().finally(() => {
          cloudHydrationPromise = null;
        });
      }
      await cloudHydrationPromise;
    }
    if (userChanged) await hydrateCloudFriendSettings();
    if (cloudHydrated) renderAuthState();
    if (enter) enterDashboardView();
  }

  function clearAuthenticatedSession() {
    window.clearTimeout(cloudSyncTimer);
    if (els.adminDialog?.open) els.adminDialog.close();
    cloudHydrated = false;
    cloudHydrationPromise = null;
    authUser = null;
    platformAdmin = false;
    plannedRoleDirections = [];
    draftRoleDirections = [];
    authMode = "login";
    records = [];
    friendSyncSettings = { mySpace: null, subscriptions: [] };
    friendPoints = [];
    adminSnapshot = null;
    lastCreatedInviteCode = "";
    selectedId = null;
    showEntryScreen();
    renderAuthState();
    render();
  }

  async function initializeAuth() {
    const config = supabaseConfiguration();
    if (!config.url || !config.anonKey || typeof window.supabase?.createClient !== "function") {
      plannedRoleDirections = loadCareerDirections();
      renderAuthState();
      renderOverviewRoleSignals();
      return;
    }
    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      renderAuthState();
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (data.session) await handleAuthenticatedSession(data.session);
      supabaseClient.auth.onAuthStateChange((event, session) => {
        window.setTimeout(() => {
      if (event === "PASSWORD_RECOVERY") {
            authUser = session?.user || null;
            authMode = "recovery";
            showEntryScreen();
            renderAuthState();
            setAuthStatus("Choose a new password for your workspace.", "success");
          } else if (event === "SIGNED_OUT") {
            clearAuthenticatedSession();
          } else if (event === "SIGNED_IN" && session && (!authUser || authUser.id !== session.user.id)) {
            handleAuthenticatedSession(session);
          }
        }, 0);
      });
    } catch (error) {
      supabaseClient = null;
      renderAuthState();
      setAuthStatus(friendlyAuthError(error), "error");
      setAccountState("error", "配置错误");
    }
  }

  async function submitAuthForm(event) {
    event.preventDefault();
    setAuthStatus();
    if (!supabaseClient) {
      setAuthStatus("Cloud accounts are not configured for this deployment.", "error");
      return;
    }
    if (!els.authForm.checkValidity()) {
      els.authForm.reportValidity();
      return;
    }
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    const passwordConfirm = els.authPasswordConfirm.value;
    if ((authMode === "register" || authMode === "recovery") && password !== passwordConfirm) {
      setAuthStatus("The two passwords do not match.", "error");
      els.authPasswordConfirm.focus();
      return;
    }

    els.authSubmit.disabled = true;
    try {
      if (authMode === "register") {
        const inviteCode = els.authInvite.value.trim().toUpperCase();
        if (inviteCode && !/^[A-Z0-9-]{6,24}$/.test(inviteCode)) {
          setAuthStatus("Enter the 6–24 character invite code supplied by the workspace owner.", "error");
          els.authInvite.focus();
          return;
        }
        const inviteToken = inviteCode ? await sha256Hex(inviteCode) : "";
        const redirectTo = authRedirectUrl();
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: els.authName.value.trim(),
              ...(inviteToken ? { invite_token: inviteToken } : {})
            },
            ...(redirectTo ? { emailRedirectTo: redirectTo } : {})
          }
        });
        if (error) throw error;
        els.authInvite.value = "";
        if (data.session) await handleAuthenticatedSession(data.session, { enter: true });
        else {
          setAuthMode("login");
          setAuthStatus("Your account is ready. Confirm your email, then sign in.", "success");
        }
      } else if (authMode === "recovery") {
        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) throw error;
        authMode = "login";
        setAuthStatus("Password updated. Opening your workspace…", "success");
        const { data } = await supabaseClient.auth.getSession();
        if (data.session) await handleAuthenticatedSession(data.session, { enter: true });
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await handleAuthenticatedSession(data.session, { enter: true });
      }
    } catch (error) {
      setAuthStatus(friendlyAuthError(error), "error");
    } finally {
      els.authSubmit.disabled = false;
    }
  }

  async function sendPasswordReset() {
    if (!supabaseClient) return;
    const email = els.authEmail.value.trim();
    if (!email || !els.authEmail.checkValidity()) {
      setAuthStatus("Enter your account email first.", "error");
      els.authEmail.focus();
      return;
    }
    els.authReset.disabled = true;
    try {
      const redirectTo = authRedirectUrl();
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
      setAuthStatus("A password reset link is on its way. Check your inbox.", "success");
    } catch (error) {
      setAuthStatus(friendlyAuthError(error), "error");
    } finally {
      els.authReset.disabled = false;
    }
  }

  async function signOutCurrentUser() {
    if (!supabaseClient || !authUser) return;
    const cacheKey = `${CLOUD_CACHE_PREFIX}${authUser.id}`;
    setAccountState("syncing", "正在退出");
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      setAccountState("error", "退出失败");
      return;
    }
    try { localStorage.removeItem(cacheKey); } catch (storageError) { /* no-op */ }
    clearAuthenticatedSession();
  }

  function setAdminStatus(message = "", state = "") {
    els.adminStatus.textContent = message;
    if (state) els.adminStatus.dataset.state = state;
    else delete els.adminStatus.dataset.state;
  }

  function formatAdminDate(value, { includeTime = false } = {}) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {})
    }).format(date);
  }

  function renderAdminSnapshot() {
    const snapshot = adminSnapshot || {};
    const summary = snapshot.summary || {};
    const invites = Array.isArray(snapshot.invites) ? snapshot.invites : [];
    const users = Array.isArray(snapshot.users) ? snapshot.users : [];
    const usageDaily = Array.isArray(snapshot.usageDaily) ? snapshot.usageDaily : [];
    const recentUsage = Array.isArray(snapshot.recentUsage) ? snapshot.recentUsage : [];

    els.adminUserCount.textContent = Number(summary.users || 0).toLocaleString("zh-CN");
    els.adminInviteCount.textContent = Number(summary.activeInvites || 0).toLocaleString("zh-CN");
    els.adminRouteCount.textContent = Number(summary.routePlanning30d || 0).toLocaleString("zh-CN");
    els.adminSearchCount.textContent = Number(summary.placeSearch30d || 0).toLocaleString("zh-CN");
    els.adminUsersCaption.textContent = `${users.length} 个账号`;

    els.adminInviteList.innerHTML = invites.length ? invites.map((invite) => {
      const exhausted = invite.maxUses !== null && Number(invite.useCount) >= Number(invite.maxUses);
      const expired = invite.expiresAt && new Date(invite.expiresAt) <= new Date();
      const available = invite.active && !exhausted && !expired;
      const useLabel = invite.maxUses === null ? `${invite.useCount} 次使用 · 不限` : `${invite.useCount} / ${invite.maxUses} 次`;
      return `<article class="admin-invite-row${available ? "" : " is-inactive"}">
        <div><strong>${escapeHtml(invite.label || invite.hint)}</strong><span>${escapeHtml(invite.hint)} · ${escapeHtml(useLabel)}</span></div>
        <small>${invite.expiresAt ? `${formatAdminDate(invite.expiresAt)} 到期` : "长期有效"}</small>
        <button type="button" data-invite-toggle="${escapeHtml(invite.id)}" data-next-active="${invite.active ? "false" : "true"}">${invite.active ? "停用" : "启用"}</button>
      </article>`;
    }).join("") : '<p class="admin-empty">还没有邀请码。创建第一个邀请码后，新用户才能注册。</p>';

    const chartMax = Math.max(1, ...usageDaily.map((day) => Number(day.routePlanning || 0) + Number(day.placeSearch || 0)));
    els.adminUsageChart.innerHTML = usageDaily.length ? usageDaily.map((day) => {
      const route = Number(day.routePlanning || 0);
      const search = Number(day.placeSearch || 0);
      const errors = Number(day.routeErrors || 0);
      return `<div class="admin-usage-day" title="${escapeHtml(formatAdminDate(day.date))} · 路线 ${route} · 搜索 ${search}${errors ? ` · 失败 ${errors}` : ""}">
        <div class="admin-usage-bars">
          <i class="is-route" style="height:${Math.max(route ? 10 : 0, route / chartMax * 100)}%"></i>
          <i class="is-search" style="height:${Math.max(search ? 10 : 0, search / chartMax * 100)}%"></i>
          ${errors ? `<b style="height:${Math.max(8, errors / chartMax * 100)}%"></b>` : ""}
        </div>
        <span>${formatAdminDate(day.date)}</span>
      </div>`;
    }).join("") : '<p class="admin-empty">暂无高德调用记录。</p>';

    const routeUsage = recentUsage.filter((item) => item.operation === "route_planning").slice(0, 8);
    els.adminRecentUsage.innerHTML = routeUsage.length ? `<div class="admin-recent-heading"><strong>最近路线规划</strong><span>最多显示 8 条</span></div>${routeUsage.map((item) => {
      const meta = item.metadata || {};
      const endpoints = [meta.originCity, meta.destinationCity].filter(Boolean).join(" → ") || "公共交通路线";
      return `<article>
        <i class="${item.status === "error" ? "is-error" : "is-success"}"></i>
        <div><strong>${escapeHtml(endpoints)}</strong><span>${escapeHtml(item.email || "未知账号")}</span></div>
        <small>${item.status === "error" ? "失败" : `${Number(meta.planCount || 0)} 个方案`} · ${formatAdminDate(item.createdAt, { includeTime: true })}</small>
      </article>`;
    }).join("")}` : '<p class="admin-empty admin-recent-empty">还没有路线规划记录。</p>';

    els.adminUserList.innerHTML = users.length ? users.map((user) => `<article class="admin-user-row">
      <span class="admin-user-avatar">${escapeHtml((user.email || "?").slice(0, 1).toUpperCase())}</span>
      <div><strong>${escapeHtml(user.displayName || user.email || "未命名账号")}</strong><span>${escapeHtml(user.email || "—")}</span></div>
      <small>注册 ${formatAdminDate(user.createdAt)}<br>最近登录 ${formatAdminDate(user.lastSignInAt, { includeTime: true })}</small>
    </article>`).join("") : '<p class="admin-empty">暂无账号。</p>';
  }

  async function loadAdminSnapshot({ announce = false } = {}) {
    if (!supabaseClient || !isPlatformAdmin()) return;
    els.adminRefresh.disabled = true;
    if (announce) setAdminStatus("正在刷新访问与用量数据…");
    try {
      const { data, error } = await supabaseClient.rpc("admin_access_snapshot");
      if (error) throw error;
      adminSnapshot = data || {};
      renderAdminSnapshot();
      setAdminStatus(`数据更新于 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}。`, "success");
    } catch (error) {
      setAdminStatus(error.message || "管理数据暂时无法读取。", "error");
    } finally {
      els.adminRefresh.disabled = false;
    }
  }

  async function openAdminDialog() {
    if (!isPlatformAdmin() || !els.adminDialog) return;
    els.adminDialog.showModal();
    await loadAdminSnapshot();
  }

  function closeAdminDialog() {
    if (els.adminDialog?.open) els.adminDialog.close();
  }

  async function createInviteCode(event) {
    event.preventDefault();
    if (!supabaseClient || !isPlatformAdmin()) return;
    const maxUses = els.adminInviteMaxUses.value ? Number(els.adminInviteMaxUses.value) : null;
    const expiry = els.adminInviteExpiry.value ? `${els.adminInviteExpiry.value}T23:59:59` : null;
    els.adminInviteCreate.disabled = true;
    setAdminStatus("正在创建邀请码…");
    try {
      const { data, error } = await supabaseClient.rpc("admin_create_invite_code", {
        p_code: els.adminInviteCode.value.trim() || null,
        p_label: els.adminInviteLabel.value.trim(),
        p_max_uses: maxUses,
        p_expires_at: expiry
      });
      if (error) throw error;
      lastCreatedInviteCode = data?.code || "";
      els.adminNewCodeValue.textContent = lastCreatedInviteCode || "—";
      els.adminNewCode.hidden = !lastCreatedInviteCode;
      els.adminInviteForm.reset();
      setAdminStatus("邀请码已创建。完整邀请码只在当前提示中显示，请立即复制。", "success");
      await loadAdminSnapshot();
    } catch (error) {
      setAdminStatus(error.message || "邀请码创建失败。", "error");
    } finally {
      els.adminInviteCreate.disabled = false;
    }
  }

  async function setInviteActive(id, active) {
    if (!supabaseClient || !isPlatformAdmin()) return;
    setAdminStatus(active ? "正在启用邀请码…" : "正在停用邀请码…");
    try {
      const { error } = await supabaseClient.rpc("admin_set_invite_active", { p_id: id, p_active: active });
      if (error) throw error;
      await loadAdminSnapshot();
    } catch (error) {
      setAdminStatus(error.message || "邀请码状态更新失败。", "error");
    }
  }

  function trackApiUsage(operation, status = "success", metadata = {}) {
    if (!supabaseClient || !authUser) return;
    supabaseClient.rpc("track_api_usage", {
      p_provider: "amap",
      p_operation: operation,
      p_status: status,
      p_metadata: metadata
    }).then(() => {}, () => {});
  }

  function parseDate(date) {
    return date ? new Date(`${date}T12:00:00`) : null;
  }

  function formatDate(date) {
    if (!date) return "未设置日期";
    const value = parseDate(date);
    return `${value.getMonth() + 1}月${value.getDate()}日`;
  }

  function dateState(date) {
    if (!date) return { overdue: false, withinWeek: false };
    const delta = parseDate(date) - parseDate(today());
    return { overdue: delta < 0, withinWeek: delta >= 0 && delta <= 7 * DAY };
  }

  function dateKey(value) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatCalendarDate(date) {
    const value = parseDate(date);
    if (!value) return "未选择日期";
    return `${value.getMonth() + 1}月${value.getDate()}日 · 周${"日一二三四五六"[value.getDay()]}`;
  }

  function eventCategory(type) {
    return eventTypeMeta[type]?.category || "deadline";
  }

  function eventTimeLabel(event) {
    if (!event.startTime) return event.type === "assessment" || event.type === "application" || event.type === "material" ? "全天截止" : "时间待定";
    return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
  }

  function recordEvents(sourceRecords = records) {
    return sourceRecords.flatMap((record) => (record.events || []).map((event) => ({ event, record })));
  }

  function compareEvents(left, right) {
    return `${left.date}T${left.startTime || "23:59"}`.localeCompare(`${right.date}T${right.startTime || "23:59"}`);
  }

  function nextIncompleteEvent(record) {
    return [...(record.events || [])]
      .filter((event) => !event.completed && event.date)
      .sort(compareEvents)[0] || null;
  }

  function externalMeetingUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function meetingPlatform(value) {
    const source = String(value || "").toLowerCase();
    if (source.includes("meeting.tencent") || source.includes("voovmeeting")) return "Tencent Meeting";
    if (source.includes("feishu") || source.includes("larksuite")) return "Feishu";
    if (source.includes("zoom")) return "Zoom";
    if (source.includes("teams.microsoft")) return "Microsoft Teams";
    if (source.includes("meet.google")) return "Google Meet";
    return externalMeetingUrl(value) ? "Online meeting" : "Link not added";
  }

  function eventLinkLabel(type) {
    if (type === "interview") return "加入面试 ↗";
    if (type === "assessment") return "打开测评 ↗";
    if (type === "offer") return "查看链接 ↗";
    return "打开链接 ↗";
  }

  function roleDirectionKey(value) {
    return `direction:${String(value || "").trim()}`;
  }

  function roleCategoryFor(record) {
    const explicitDirection = String(record.roleDirection || "").trim();
    if (explicitDirection && (!plannedRoleDirections.length || plannedRoleDirections.includes(explicitDirection))) {
      return { key: roleDirectionKey(explicitDirection), label: explicitDirection };
    }
    if (plannedRoleDirections.length) return { key: "unclassified", label: "未分类" };
    const source = `${record.roleCategory || ""} ${record.role || ""}`.trim();
    return roleCategoryRules.find((category) => category.pattern.test(source)) || { key: "other", label: "其他" };
  }

  function recordReachedApplied(record) {
    return ["applied", "test", "interview", "offer", "ended"].includes(record.stage)
      || (record.timeline || []).some((item) => /已投递|投递成功|完成投递|提交投递/.test(item.label || ""));
  }

  function recordReachedInterview(record) {
    return ["interview", "offer"].includes(record.stage)
      || (record.timeline || []).some((item) => /面试|一面|二面|三面|终面/.test(item.label || ""))
      || (record.events || []).some((event) => event.type === "interview");
  }

  function firstRecordDate(record, matcher, fallbackEvents = []) {
    const timelineDates = (record.timeline || [])
      .filter((item) => item.date && matcher.test(item.label || ""))
      .map((item) => item.date);
    const eventDates = (record.events || [])
      .filter((event) => event.date && fallbackEvents.includes(event.type))
      .map((event) => event.date);
    return [...timelineDates, ...eventDates].sort()[0] || "";
  }

  function interviewResponseDays(record) {
    if (!recordReachedInterview(record)) return null;
    const appliedDate = firstRecordDate(record, /已投递|投递成功|完成投递|提交投递/);
    const interviewDate = firstRecordDate(record, /面试|一面|二面|三面|终面/, ["interview"]);
    if (!appliedDate || !interviewDate) return null;
    const days = Math.round((parseDate(interviewDate) - parseDate(appliedDate)) / DAY);
    return days >= 0 ? days : null;
  }

  function medianNumber(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  function setAppView(viewName) {
    const viewMap = {
      overview: els.overviewView,
      applications: els.applicationsView,
      research: els.researchView
    };
    if (!viewMap[viewName]) return;
    const previousViewName = currentAppView;
    currentAppView = viewName;
    Object.entries(viewMap).forEach(([name, view]) => {
      view.hidden = name !== viewName;
    });
    if (previousViewName !== viewName) {
      const viewOrder = ["overview", "applications", "research"];
      const direction = viewOrder.indexOf(viewName) >= viewOrder.indexOf(previousViewName) ? "forward" : "backward";
      const activeView = viewMap[viewName];
      activeView.classList.remove("is-view-entering-forward", "is-view-entering-backward");
      activeView.classList.add(`is-view-entering-${direction}`);
      window.setTimeout(() => activeView.classList.remove(`is-view-entering-${direction}`), 480);
    }
    els.appViewButtons.forEach((button) => {
      const active = button.dataset.appView === viewName;
      button.classList.toggle("is-active", active);
      if (button.classList.contains("sidebar-item")) {
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    if (els.sidebarNav) {
      const navItems = [...els.sidebarNav.querySelectorAll(".sidebar-item")];
      const activeIndex = navItems.findIndex((button) => button.dataset.appView === viewName);
      if (activeIndex >= 0) els.sidebarNav.style.setProperty("--active-index", activeIndex);
    }
    window.requestAnimationFrame(() => {
      if (viewName === "research") {
        syncToolbarClearance();
        mainMap?.resize();
        if (previousViewName !== viewName) {
          setJobsPanelCollapsed(true, { coordinatePanels: false });
          showMapOverview(false);
        }
        schedulePointClusterUpdate();
      }
      if (viewName === "overview") overviewMap?.resize();
    });
  }

  function horizontalFunnelPath(normStart, normEnd, width, height, layerScale) {
    const middle = height / 2;
    const startHalfHeight = normStart * height * 0.44 * layerScale;
    const endHalfHeight = normEnd * height * 0.44 * layerScale;
    const control = width * 0.55;
    return [
      `M 0 ${middle - startHalfHeight}`,
      `C ${control} ${middle - startHalfHeight}, ${width - control} ${middle - endHalfHeight}, ${width} ${middle - endHalfHeight}`,
      `L ${width} ${middle + endHalfHeight}`,
      `C ${width - control} ${middle + endHalfHeight}, ${control} ${middle + startHalfHeight}, 0 ${middle + startHalfHeight}`,
      "Z"
    ].join(" ");
  }

  function renderOverviewPipeline() {
    if (!els.overviewPipeline) return;
    const stageSpecs = [
      { key: "pool", label: "岗位池", scopeLabel: "岗位池（未结束）", stages: ["screening", "pending", "applied", "test", "interview", "offer"], colors: ["#395d61", "#4f9da2"] },
      { key: "submitted", label: "已投递", scopeLabel: "已投递及以后", stages: ["applied", "test", "interview", "offer"], colors: ["#4f9da2", "#8e7eb0"] },
      { key: "assessment", label: "测评", scopeLabel: "测评 / 笔试及以后", stages: ["test", "interview", "offer"], colors: ["#8e7eb0", "#d29a61"] },
      { key: "interview", label: "面试", scopeLabel: "面试及以后", stages: ["interview", "offer"], colors: ["#d29a61", "#62b496"] },
      { key: "offer", label: "Offer", scopeLabel: "已获得 Offer", stages: ["offer"], colors: ["#62b496", "#315a5c"] }
    ];
    const entries = stageSpecs.map((stage) => ({
      ...stage,
      count: records.filter((record) => stage.stages.includes(record.stage)).length
    }));
    const activeCount = entries[0]?.count || 0;
    const endedCount = records.filter((record) => record.stage === "ended").length;
    const maxCount = Math.max(activeCount, 1);
    const norms = entries.map((item) => Math.max(item.count / maxCount, 0.07));
    const layerSettings = [
      { scale: 1, opacity: 0.16 },
      { scale: 0.88, opacity: 0.34 },
      { scale: 0.76, opacity: 0.94 }
    ];
    els.overviewPipelineTotal.textContent = endedCount ? `${activeCount} 进行中 · ${endedCount} 已结束` : `${activeCount} 个进行中`;
    els.overviewPipeline.setAttribute("aria-label", `累计转化漏斗：${entries.map((item) => `${item.scopeLabel} ${item.count} 个`).join("，")}`);
    els.overviewPipeline.innerHTML = `
      <div class="overview-funnel-track">
        ${entries.map((item, index) => {
          const share = activeCount ? Math.round(item.count / activeCount * 100) : 0;
          const normStart = norms[index] ?? 0.07;
          const normEnd = norms[Math.min(index + 1, norms.length - 1)] ?? 0.07;
          const gradientId = `overview-funnel-gradient-${item.key}`;
          const stages = item.stages.join(",");
          return `
            <button
              class="funnel-stage"
              type="button"
              data-overview-stages="${stages}"
              data-overview-scope-label="${escapeHtml(item.scopeLabel)}"
              style="--funnel-delay:${(index * 0.09).toFixed(2)}s"
              aria-label="查看${escapeHtml(item.scopeLabel)}的岗位，共 ${item.count} 个，占进行中岗位 ${share}%"
            >
              <svg class="funnel-stage-shape" viewBox="0 0 200 132" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="${gradientId}" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stop-color="${item.colors[0]}"></stop>
                    <stop offset="100%" stop-color="${item.colors[1]}"></stop>
                  </linearGradient>
                </defs>
                ${layerSettings.map((layer) => `<path class="funnel-stage-layer" d="${horizontalFunnelPath(normStart, normEnd, 200, 132, layer.scale)}" fill="url(#${gradientId})" opacity="${layer.opacity}"></path>`).join("")}
              </svg>
              <strong class="funnel-stage-value">${item.count}</strong>
              <span class="funnel-stage-percent">${share}%</span>
              <span class="funnel-stage-label">${escapeHtml(item.label)}</span>
            </button>`;
        }).join("")}
      </div>`;

    const recent = [...records]
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
      .slice(0, 3);
    els.overviewRecent.innerHTML = recent.length
      ? recent.map((record) => `
          <div class="recent-update">
            <strong>${escapeHtml(record.company)} · ${escapeHtml(record.role)}</strong>
            <span>${escapeHtml(statusMeta[record.stage]?.label || record.stage)} · 更新于 ${escapeHtml(formatDate(record.updatedAt))}</span>
          </div>`).join("")
      : '<p class="overview-empty">新增岗位后，最近更新会出现在这里。</p>';
  }

  function renderOverviewRoleSignals() {
    if (!els.overviewRoleChart) return;
    const plannedLabel = plannedRoleDirections.length
      ? `${plannedRoleDirections.slice(0, 2).join(" / ")}${plannedRoleDirections.length > 2 ? ` +${plannedRoleDirections.length - 2}` : ""}`
      : "点击选择";
    els.careerDirectionsOpen.innerHTML = `<span>计划方向</span><strong>${escapeHtml(plannedLabel)}</strong>`;
    els.careerDirectionsOpen.title = plannedRoleDirections.length ? `计划求职方向：${plannedRoleDirections.join("、")}` : "选择计划求职的岗位方向";
    els.careerDirectionsOpen.classList.toggle("is-empty", !plannedRoleDirections.length);
    const appliedRecords = records.filter(recordReachedApplied);
    const interviewedRecords = appliedRecords.filter(recordReachedInterview);
    const responseDays = interviewedRecords.map(interviewResponseDays).filter((value) => value !== null);
    const overallRate = appliedRecords.length ? Math.round(interviewedRecords.length / appliedRecords.length * 100) : 0;
    const medianDays = medianNumber(responseDays);
    els.overviewRoleRate.textContent = `${overallRate}%`;
    els.overviewRoleSpeed.textContent = medianDays === null ? "响应时间待积累" : `中位 ${medianDays} 天进面`;

    const categoryMap = new Map();
    plannedRoleDirections.forEach((direction) => {
      const key = roleDirectionKey(direction);
      categoryMap.set(key, { key, label: direction, applied: 0, interviewed: 0, responseDays: [] });
    });
    appliedRecords.forEach((record) => {
      const category = roleCategoryFor(record);
      const current = categoryMap.get(category.key) || { ...category, applied: 0, interviewed: 0, responseDays: [] };
      current.applied += 1;
      if (recordReachedInterview(record)) {
        current.interviewed += 1;
        const days = interviewResponseDays(record);
        if (days !== null) current.responseDays.push(days);
      }
      categoryMap.set(category.key, current);
    });
    const sortedCategories = plannedRoleDirections.length
      ? [
          ...plannedRoleDirections.map((direction) => categoryMap.get(roleDirectionKey(direction))),
          ...[...categoryMap.values()]
            .filter((category) => !plannedRoleDirections.includes(category.label))
            .sort((left, right) => right.applied - left.applied || left.label.localeCompare(right.label, "zh-CN"))
        ].filter(Boolean)
      : [...categoryMap.values()]
          .sort((left, right) => right.applied - left.applied || right.interviewed - left.interviewed || left.label.localeCompare(right.label, "zh-CN"));
    if (!sortedCategories.length) {
      const plannedChips = plannedRoleDirections.length
        ? plannedRoleDirections.map((value) => `<span>${escapeHtml(value)}</span>`).join("")
        : careerDirectionOptions.slice(0, 6).map((value) => `<span>${escapeHtml(value)}</span>`).join("");
      els.overviewRoleChart.innerHTML = `
        <button class="role-onboarding-empty" type="button" data-open-career-directions>
          <span class="role-onboarding-copy">
            <small>${plannedRoleDirections.length ? "YOUR TARGETS" : "START WITH A DIRECTION"}</small>
            <strong>${plannedRoleDirections.length ? "等待第一条投递信号" : "先告诉我你想投什么"}</strong>
            <em>${plannedRoleDirections.length ? "完成首次投递后，这里会比较各方向的进面表现。" : "选择目标方向后，再把感兴趣的岗位放进岗位池。"}</em>
          </span>
          <span class="role-onboarding-bubbles" aria-hidden="true">${plannedChips}</span>
        </button>`;
      return;
    }
    const categories = sortedCategories.map((category, index) => ({
      ...category,
      color: roleChartPalette[index % roleChartPalette.length]
    }));
    const distribution = categories.filter((category) => category.applied > 0);
    const circumference = 2 * Math.PI * 44;
    let segmentOffset = 0;
    const donutSegments = distribution.map((category) => {
      const share = category.applied / appliedRecords.length;
      const segmentSpan = share * circumference;
      // Flat ends and a reserved gap keep adjacent slices visually independent.
      const visibleSpan = Math.max(1, segmentSpan - Math.min(3, segmentSpan * 0.16));
      const dashOffset = -segmentOffset;
      segmentOffset += segmentSpan;
      const percent = Math.round(share * 100);
      const filterAttribute = ` data-role-category="${escapeHtml(category.key)}"`;
      return `<circle class="role-donut-segment" cx="56" cy="56" r="44" fill="none" stroke="${category.color}" stroke-width="18" stroke-linecap="butt" stroke-dasharray="${visibleSpan.toFixed(2)} ${(circumference - visibleSpan).toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" tabindex="0" role="button" data-role-signal="${escapeHtml(category.key)}" data-role-label="${escapeHtml(category.label)}" data-role-count="${category.applied}" data-role-percent="${percent}"${filterAttribute} aria-label="${escapeHtml(category.label)}：${category.applied} 个岗位，占 ${percent}%"><title>${escapeHtml(category.label)} ${category.applied} 个，占 ${percent}%</title></circle>`;
    }).join("");
    const distributionLegend = distribution.map((category) => {
      const percent = Math.round(category.applied / appliedRecords.length * 100);
      const filterAttribute = ` data-role-category="${escapeHtml(category.key)}"`;
      return `
        <button
          class="role-distribution-item"
          type="button"
          data-role-signal="${escapeHtml(category.key)}"
          data-role-label="${escapeHtml(category.label)}"
          data-role-count="${category.applied}"
          data-role-percent="${percent}"
          ${filterAttribute}
          style="--role-color:${category.color}"
          aria-label="${escapeHtml(category.label)}：${category.applied} 个岗位，占 ${percent}%"
        >
          <span><i aria-hidden="true"></i>${escapeHtml(category.label)}</span>
          <strong>${category.applied}<small>${percent}%</small></strong>
        </button>`;
    }).join("");
    const progressRows = categories.map((category) => {
      const rate = category.applied ? Math.round(category.interviewed / category.applied * 100) : 0;
      const categoryMedian = medianNumber(category.responseDays);
      const timingLabel = categoryMedian === null ? "时间待积累" : `中位 ${categoryMedian} 天`;
      return `
        <button
          class="role-progress-row"
          type="button"
          data-role-category="${escapeHtml(category.key)}"
          data-role-label="${escapeHtml(category.label)}"
          aria-label="${escapeHtml(category.label)}方向：已投递 ${category.applied} 个，曾进入面试 ${category.interviewed} 个，进面率 ${rate}%，${escapeHtml(timingLabel)}"
          style="--role-color:${category.color};--role-progress:${rate}%"
        >
          <strong class="role-progress-value">${rate}%</strong>
          <span class="role-progress-track" aria-hidden="true"><i></i></span>
          <span class="role-progress-caption">
            <span class="role-progress-label"><i aria-hidden="true"></i>${escapeHtml(category.label)}</span>
            <small>${category.interviewed} / ${category.applied} 进面</small>
          </span>
        </button>`;
    }).join("");
    els.overviewRoleChart.innerHTML = `
      <section class="role-viz-panel role-distribution-panel" aria-label="投递方向分布">
        <header class="role-viz-heading"><strong>投递方向分布</strong><span>悬停查看 · 点击筛选</span></header>
        <div class="role-distribution-body">
          <div class="role-donut" role="group" aria-label="已投递岗位方向分布，共 ${appliedRecords.length} 个岗位">
            <svg viewBox="0 0 112 112">
              <circle class="role-donut-track" cx="56" cy="56" r="44" fill="none" stroke-width="17"></circle>
              <g transform="rotate(-90 56 56)">${donutSegments}</g>
            </svg>
            <span class="role-donut-center" data-default-value="${appliedRecords.length}" data-default-label="已投递">
              <strong>${appliedRecords.length}</strong><small>已投递</small>
            </span>
          </div>
          <div class="role-distribution-legend">${distributionLegend}</div>
        </div>
      </section>
      <section class="role-viz-panel role-conversion-panel" aria-label="方向进面率">
        <header class="role-viz-heading"><strong>方向进面率</strong><span>点击方向查看岗位</span></header>
        <div class="role-progress-list">${progressRows}</div>
      </section>`;
  }

  function setRoleSignalHighlight(control = null) {
    if (!els.overviewRoleChart) return;
    const signal = control?.dataset.roleSignal || "";
    const panel = els.overviewRoleChart.querySelector(".role-distribution-panel");
    const center = els.overviewRoleChart.querySelector(".role-donut-center");
    panel?.classList.toggle("has-active", Boolean(signal));
    els.overviewRoleChart.querySelectorAll("[data-role-signal]").forEach((item) => {
      item.classList.toggle("is-active", Boolean(signal) && item.dataset.roleSignal === signal);
    });
    if (!center) return;
    const value = center.querySelector("strong");
    const label = center.querySelector("small");
    if (signal && control) {
      value.textContent = `${control.dataset.rolePercent || 0}%`;
      label.textContent = `${control.dataset.roleLabel || "方向"} · ${control.dataset.roleCount || 0} 个`;
      return;
    }
    value.textContent = center.dataset.defaultValue || "0";
    label.textContent = center.dataset.defaultLabel || "已投递";
  }

  function renderOverviewAgenda() {
    if (!els.overviewAgenda) return;
    const agenda = recordEvents()
      .filter(({ event, record }) => !event.completed && event.date && record.stage !== "ended")
      .sort((left, right) => compareEvents(left.event, right.event));
    const overdue = agenda.filter(({ event }) => event.date < today()).length;
    els.overviewOverdue.textContent = overdue ? `${overdue} 个逾期` : "没有逾期";
    els.overviewOverdue.classList.toggle("overdue", overdue > 0);
    const visibleAgenda = agenda.slice(0, 7);
    if (!visibleAgenda.length) {
      els.overviewAgenda.innerHTML = `
        <div class="overview-agenda-empty">
          <span>CALENDAR CLEAR</span>
          <strong>未来七天暂无确定日程</strong>
          <small>新增笔试截止、材料截止或面试时间后，会自动出现在这里。</small>
        </div>`;
      return;
    }
    els.overviewAgenda.innerHTML = visibleAgenda.map(({ event, record }) => {
      const value = parseDate(event.date);
      const actionHref = externalMeetingUrl(event.location);
      const linkAction = actionHref
        ? `<a class="overview-agenda-join" href="${escapeHtml(actionHref)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(eventLinkLabel(event.type).replace(" ↗", ""))}：${escapeHtml(record.company)} ${escapeHtml(event.title || eventTypeMeta[event.type]?.label || "日程")}">${escapeHtml(eventLinkLabel(event.type))}</a>`
        : "";
      return `
        <article class="overview-agenda-item${event.date < today() ? " is-overdue" : ""}">
          <button class="overview-agenda-main" type="button" data-overview-event-date="${escapeHtml(event.date)}">
            <span class="agenda-date-block"><b>${value.getDate()}</b><span>${value.getMonth() + 1} 月</span></span>
            <span class="overview-agenda-copy">
              <strong><i class="event-dot event-${eventCategory(event.type)}"></i> ${escapeHtml(event.title)}</strong>
              <span>${escapeHtml(record.company)} · ${escapeHtml(record.role)}</span>
            </span>
            <span class="overview-agenda-time">${escapeHtml(eventTimeLabel(event))}</span>
          </button>
          ${linkAction}
        </article>`;
    }).join("");
  }

  function renderApplications() {
    if (!els.applicationsList) return;
    els.applicationsList.querySelectorAll("select").forEach((select) => systemSelectRegistry.delete(select));
    const query = String(els.applicationsQuery?.value || "").trim().toLocaleLowerCase("zh-CN");
    const stage = els.applicationsStageFilter?.value || "all";
    const funnelStageSet = stage === "all" && applicationsFunnelStages?.length
      ? new Set(applicationsFunnelStages)
      : null;
    const hasRoleScope = Boolean(applicationsRoleCategory);
    if (els.applicationsScope) {
      els.applicationsScope.hidden = !funnelStageSet && !hasRoleScope;
      els.applicationsScopeLabel.textContent = funnelStageSet
        ? `漏斗范围 · ${applicationsFunnelLabel}`
        : hasRoleScope
          ? `岗位方向 · ${applicationsRoleLabel}`
          : "";
    }
    const visible = records.filter((record) => {
      if (funnelStageSet && !funnelStageSet.has(record.stage)) return false;
      if (hasRoleScope && roleCategoryFor(record).key !== applicationsRoleCategory) return false;
      if (stage !== "all" && record.stage !== stage) return false;
      if (!query) return true;
      return [record.company, record.role, record.city, record.building, record.address]
        .some((value) => String(value || "").toLocaleLowerCase("zh-CN").includes(query));
    });
    if (!visible.length) {
      els.applicationsList.innerHTML = '<p class="overview-empty">没有符合当前搜索条件的岗位。</p>';
      return;
    }
    els.applicationsList.innerHTML = visible.map((record) => {
      const schedule = nextIncompleteEvent(record);
      const jobUrl = externalMeetingUrl(record.jdUrl || record.jdSnapshot?.sourceUrl);
      const companyMarkup = jobUrl
        ? `<a class="application-company-link" href="${escapeHtml(jobUrl)}" target="_blank" rel="noopener noreferrer" title="打开岗位详情：${escapeHtml(record.company)} · ${escapeHtml(record.role)}">${escapeHtml(record.company)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"/><path d="m19 5-8 8"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg></a>`
        : escapeHtml(record.company);
      const stageOptions = Object.entries(statusMeta).map(([value, meta]) =>
        `<option value="${escapeHtml(value)}"${record.stage === value ? " selected" : ""}>${escapeHtml(meta.label)}</option>`
      ).join("");
      return `
        <article class="application-row">
          <div class="application-main">
            <strong>${companyMarkup} · ${escapeHtml(record.role)}</strong>
            <span>${escapeHtml(record.stageDetail || "尚未填写阶段说明")}</span>
          </div>
          <label class="application-stage-control" data-stage="${escapeHtml(record.stage)}">
            <span class="visually-hidden">更新${escapeHtml(record.company)} · ${escapeHtml(record.role)}的进度</span>
            <select id="application-stage-${escapeHtml(record.id)}" data-application-stage="${escapeHtml(record.id)}" aria-label="更新${escapeHtml(record.company)} · ${escapeHtml(record.role)}的进度">
              ${stageOptions}
            </select>
          </label>
          <div class="application-base">
            <strong>${escapeHtml(record.city || "城市待确认")}</strong>
            <span>${escapeHtml(record.building || "办公地点待确认")}</span>
          </div>
          <button class="application-schedule" type="button" data-application-schedule="${escapeHtml(record.id)}" aria-label="仅编辑${escapeHtml(record.company)} · ${escapeHtml(record.role)}的日程">
            <strong>${schedule ? escapeHtml(formatDate(schedule.date)) : "暂无日程"}</strong>
            <span>${schedule ? escapeHtml(schedule.title) : "点击添加客观节点"}</span>
          </button>
          <div class="application-actions" role="group" aria-label="${escapeHtml(record.company)} · ${escapeHtml(record.role)}的操作">
            <button class="application-action application-edit" type="button" data-application-edit="${escapeHtml(record.id)}" aria-label="编辑岗位：${escapeHtml(record.company)} · ${escapeHtml(record.role)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.7-10.7a2.1 2.1 0 0 0-4-3L4 17v3Z"/><path d="m13.5 7.5 3 3"/></svg>
              <span>编辑</span>
            </button>
            <button class="application-action application-open" type="button" data-application-open="${escapeHtml(record.id)}" aria-label="在地图中查看：${escapeHtml(record.company)} · ${escapeHtml(record.role)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"/><path d="m19 5-8 8"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>
              <span>地图</span>
            </button>
            <button class="application-action application-delete" type="button" data-application-delete="${escapeHtml(record.id)}" aria-label="删除岗位：${escapeHtml(record.company)} · ${escapeHtml(record.role)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m7 7 1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></svg>
              <span>删除</span>
            </button>
          </div>
        </article>`;
    }).join("");
    els.applicationsList.querySelectorAll("[data-application-stage]").forEach(initializeSystemSelect);
  }

  function updateApplicationStage(recordId, nextStage) {
    const record = records.find((item) => item.id === recordId);
    if (!record || record.stage === nextStage || !statusMeta[nextStage]) return;
    const restoreScroll = els.applicationsList.scrollTop;
    const statusLabel = statusMeta[nextStage].label;
    const updated = normalizeRecord({
      ...record,
      stage: nextStage,
      updatedAt: today(),
      timeline: [{ date: today(), label: `更新为${statusLabel}` }, ...(record.timeline || [])]
    });
    records = records.map((item) => item.id === recordId ? updated : item);
    saveRecords();
    render();
    requestAnimationFrame(() => {
      els.applicationsList.scrollTop = restoreScroll;
    });
  }

  function deleteApplicationRecord(recordId) {
    const record = records.find((item) => item.id === recordId);
    if (!record || !window.confirm(`删除“${record.company} · ${record.role}”？此操作无法撤销。`)) return;
    const restoreScroll = els.applicationsList.scrollTop;
    records = records.filter((item) => item.id !== recordId);
    if (selectedId === recordId) selectedId = records[0]?.id || null;
    saveRecords();
    render();
    requestAnimationFrame(() => {
      els.applicationsList.scrollTop = restoreScroll;
    });
  }

  function overviewProvinceName(record, provinceNames) {
    const provided = String(record.province || "").trim();
    if (provinceNames.has(provided)) return provided;
    const city = String(record.city || "").trim().replace(/(?:特别行政区|市)$/u, "");
    if (overviewProvinceByCity[city]) return overviewProvinceByCity[city];
    const address = [record.address, record.building, record.city, provided].filter(Boolean).join(" ");
    return [...provinceNames].find((name) => address.includes(name) || address.includes(name.replace(/(?:壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)$/u, ""))) || "";
  }

  function overviewGeometryRings(geometry) {
    if (!geometry?.coordinates) return [];
    if (geometry.type === "Polygon") return geometry.coordinates;
    if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
    return [];
  }

  function overviewProvincePath(geometry, project) {
    return overviewGeometryRings(geometry).map((ring) => {
      if (!ring.length) return "";
      const step = Math.max(1, Math.ceil(ring.length / 360));
      const sampled = ring.filter((_, index) => index % step === 0 || index === ring.length - 1);
      return sampled.map((point, index) => {
        const [x, y] = project(point);
        return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(" ") + " Z";
    }).join(" ");
  }

  function openOverviewProvince(provinceName, provinceRecords) {
    if (!provinceRecords.length) return;
    const cityCounts = new Map();
    provinceRecords.forEach((record) => {
      const city = String(record.city || "").trim();
      if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
    });
    const dominantCity = [...cityCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "all";
    if ([...els.cityFilter.options].some((option) => option.value === dominantCity)) {
      els.cityFilter.value = dominantCity;
      els.cityFilter.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setAppView("research");
    window.setTimeout(() => fitVisibleRecords(true), 80);
  }

  function renderOverviewMapMarkers() {
    if (!overviewMapReady || !els.overviewMapSummary) return;
    const container = byId("overview-map");
    const collection = window.CHINA_PROVINCE_DATA;
    const features = collection?.features?.filter((feature) => feature.properties?.name && feature.geometry) || [];
    if (!container || !features.length) {
      els.overviewMapSummary.textContent = "省级地图数据暂不可用。";
      return;
    }

    const provinceNames = new Set(features.map((feature) => feature.properties.name));
    const provinceRecords = new Map();
    records.filter(isMappable).forEach((record) => {
      const province = overviewProvinceName(record, provinceNames);
      if (!province) return;
      const group = provinceRecords.get(province) || [];
      group.push(record);
      provinceRecords.set(province, group);
    });

    const allPoints = features.flatMap((feature) => overviewGeometryRings(feature.geometry).flat());
    // Hainan's geometry also carries remote South China Sea islands. They remain in
    // the data, but must not determine the overview projection or shrink mainland China.
    const focusPoints = allPoints.filter(([lng, lat]) => lng >= 73 && lng <= 135 && lat >= 17.5 && lat <= 54.5);
    const referenceScale = Math.cos(35 * Math.PI / 180);
    const projectedPoints = focusPoints.map(([lng, lat]) => [lng * referenceScale, lat]);
    const minX = Math.min(...projectedPoints.map(([x]) => x));
    const maxX = Math.max(...projectedPoints.map(([x]) => x));
    const minY = Math.min(...projectedPoints.map(([, y]) => y));
    const maxY = Math.max(...projectedPoints.map(([, y]) => y));
    const width = 1000;
    const height = 600;
    const paddingX = 54;
    const paddingY = 40;
    const scale = Math.min((width - paddingX * 2) / (maxX - minX), (height - paddingY * 2) / (maxY - minY));
    const contentWidth = (maxX - minX) * scale;
    const contentHeight = (maxY - minY) * scale;
    const offsetX = (width - contentWidth) / 2;
    const offsetY = (height - contentHeight) / 2;
    const project = ([lng, lat]) => [
      offsetX + (lng * referenceScale - minX) * scale,
      height - offsetY - (lat - minY) * scale
    ];

    const paths = features.map((feature) => {
      const name = feature.properties.name;
      const count = provinceRecords.get(name)?.length || 0;
      const intensity = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
      return `<path class="overview-province count-${intensity}" d="${overviewProvincePath(feature.geometry, project)}" fill-rule="evenodd" data-overview-province="${escapeHtml(name)}" data-count="${count}" tabindex="0" role="button" aria-label="${escapeHtml(name)}：${count ? `${count} 个岗位，点击进入地图 Research` : "暂无岗位"}"><title>${escapeHtml(name)} · ${count} 个岗位</title></path>`;
    }).join("");
    const countryGeometry = window.CHINA_BOUNDARY_DATA?.features?.find((feature) => feature.properties?.level === "country")?.geometry;
    const countryOutline = countryGeometry ? overviewProvincePath(countryGeometry, project) : "";
    const labels = features.map((feature) => {
      const name = feature.properties.name;
      const count = provinceRecords.get(name)?.length || 0;
      const anchor = feature.properties.centroid || feature.properties.center;
      if (!count || !anchor) return "";
      const [x, y] = project(anchor);
      return `<g class="overview-province-count" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" aria-hidden="true"><circle r="16"></circle><text y="1">${count}</text></g>`;
    }).join("");

    container.innerHTML = `
      <svg class="overview-choropleth" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-label="中国省级岗位分布色块地图">
        <defs>
          <filter id="overview-map-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#153f36" flood-opacity=".12"></feDropShadow>
          </filter>
        </defs>
        <g class="overview-province-layer" filter="url(#overview-map-shadow)">${paths}</g>
        ${countryOutline ? `<path class="overview-country-outline" d="${countryOutline}" fill="none" fill-rule="evenodd" aria-hidden="true"></path>` : ""}
        <g class="overview-province-labels">${labels}</g>
      </svg>
      <div class="overview-map-legend" aria-hidden="true"><span><i class="count-0"></i>0</span><span><i class="count-1"></i>1</span><span><i class="count-2"></i>2–3</span><span><i class="count-3"></i>4+</span></div>`;

    const provincePaths = [...container.querySelectorAll("[data-overview-province]")];
    const setProvinceState = (path = null) => {
      container.classList.toggle("has-active-province", Boolean(path));
      provincePaths.forEach((item) => item.classList.toggle("is-active", item === path));
    };
    provincePaths.forEach((path) => {
      path.addEventListener("pointerenter", () => setProvinceState(path));
      path.addEventListener("pointerleave", () => setProvinceState());
      path.addEventListener("focus", () => setProvinceState(path));
      path.addEventListener("blur", () => setProvinceState());
      path.addEventListener("click", () => openOverviewProvince(path.dataset.overviewProvince, provinceRecords.get(path.dataset.overviewProvince) || []));
      path.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        path.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    });

    const mappedCount = [...provinceRecords.values()].reduce((total, group) => total + group.length, 0);
    els.overviewMapSummary.textContent = provinceRecords.size
      ? `${provinceRecords.size} 个区域 · ${mappedCount} 个岗位`
      : "暂无已定位岗位";
    els.overviewMapSummary.title = provinceRecords.size ? "点击有岗位的省份进入地图 Research" : "";
  }

  function renderWorkspaceOverview() {
    if (els.overviewDate) {
      const label = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
      els.overviewDate.textContent = `${label} · CAMPUS RECRUITING WORKSPACE`;
    }
    if (els.demoDataClear) {
      const demoCount = records.filter((record) => record.isDemo).length;
      els.demoDataClear.hidden = demoCount === 0;
      els.demoDataClear.innerHTML = showcaseDemoActive
        ? '<span>DEMO</span>退出演示'
        : '<span>DEMO</span>清空示例数据';
      els.demoDataClear.title = demoCount
        ? (showcaseDemoActive ? "退出演示并返回首页；本次修改不会保存" : `当前包含 ${demoCount} 条示例岗位；点击清空`)
        : "";
    }
    renderOverviewPipeline();
    renderOverviewRoleSignals();
    renderOverviewAgenda();
    renderApplications();
    renderOverviewMapMarkers();
  }

  function touchRecordSchedule(record) {
    record.updatedAt = today();
    return record;
  }

  function renderJobScheduleList() {
    const schedules = [...draftJobEvents].sort(compareEvents);
    if (!schedules.length) {
      els.jobScheduleList.innerHTML = '<p class="job-schedule-empty">还没有岗位日程。可填写笔试 / 测评截止、下一次面试或材料截止。</p>';
      return;
    }
    els.jobScheduleList.innerHTML = schedules.map((event) => {
      const category = eventCategory(event.type);
      const meta = [eventTypeMeta[event.type]?.label, event.location].filter(Boolean).join(" · ");
      return `
        <article class="job-schedule-item" data-category="${category}">
          <div class="job-schedule-item-main">
            <span class="event-dot event-${category}" aria-hidden="true"></span>
            <div>
              <strong>${escapeHtml(event.title)}</strong>
              <p>${escapeHtml(meta)}</p>
            </div>
          </div>
          <time datetime="${escapeHtml(event.date)}">${escapeHtml(formatDate(event.date))} · ${escapeHtml(eventTimeLabel(event))}</time>
          <div class="job-schedule-item-actions" aria-label="日程节点操作">
            <button type="button" data-job-schedule-action="edit" data-event-id="${escapeHtml(event.id)}">编辑</button>
            <button type="button" data-job-schedule-action="remove" data-event-id="${escapeHtml(event.id)}">移除</button>
          </div>
        </article>`;
    }).join("");
  }

  function closeJobScheduleEditor() {
    editingJobScheduleId = null;
    els.jobScheduleCompose.hidden = true;
    els.jobScheduleError.textContent = "";
    els.jobScheduleId.value = "";
  }

  function openJobScheduleEditor(eventId = null) {
    const schedule = eventId ? draftJobEvents.find((event) => event.id === eventId) : null;
    editingJobScheduleId = schedule?.id || null;
    els.jobScheduleId.value = schedule?.id || "";
    els.jobScheduleType.value = schedule?.type || inferEventType(els.stage.value);
    syncSystemSelect(els.jobScheduleType);
    els.jobScheduleDate.value = schedule?.date || "";
    els.jobScheduleStartTime.value = schedule?.startTime || "";
    els.jobScheduleEndTime.value = schedule?.endTime || "";
    els.jobScheduleTitle.value = schedule?.title || "";
    els.jobScheduleLocation.value = schedule?.location || "";
    els.jobScheduleNotes.value = schedule?.notes || "";
    els.jobScheduleError.textContent = "";
    els.jobScheduleCompose.hidden = false;
    els.jobScheduleDate.focus({ preventScroll: true });
  }

  function saveJobScheduleDraft() {
    els.jobScheduleError.textContent = "";
    const type = els.jobScheduleType.value;
    const date = els.jobScheduleDate.value;
    const startTime = els.jobScheduleStartTime.value;
    const endTime = els.jobScheduleEndTime.value;
    if (!date) {
      els.jobScheduleError.textContent = "请填写这个日程节点的日期。";
      els.jobScheduleDate.focus();
      return;
    }
    if (type === "interview" && !startTime) {
      els.jobScheduleError.textContent = "面试日程需要填写具体开始时间。";
      els.jobScheduleStartTime.focus();
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      els.jobScheduleError.textContent = "结束时间需要晚于开始时间。";
      els.jobScheduleEndTime.focus();
      return;
    }
    const previous = editingJobScheduleId
      ? draftJobEvents.find((event) => event.id === editingJobScheduleId)
      : null;
    const schedule = normalizeEvent({
      ...(previous || {}),
      id: previous?.id || makeEventId(),
      type,
      title: els.jobScheduleTitle.value.trim() || eventTypeMeta[type].label,
      date,
      startTime,
      endTime,
      location: els.jobScheduleLocation.value.trim(),
      notes: els.jobScheduleNotes.value.trim(),
      source: "manual"
    });
    draftJobEvents = previous
      ? draftJobEvents.map((event) => event.id === previous.id ? schedule : event)
      : [...draftJobEvents, schedule];
    closeJobScheduleEditor();
    renderJobScheduleList();
  }

  function removeJobScheduleDraft(eventId) {
    draftJobEvents = draftJobEvents.filter((event) => event.id !== eventId);
    if (editingJobScheduleId === eventId) closeJobScheduleEditor();
    renderJobScheduleList();
  }

  function isMappable(record) {
    return record.accuracy !== "unknown"
      && parseCoordinate(record.lng, -180, 180) !== null
      && parseCoordinate(record.lat, -90, 90) !== null;
  }

  function parseCoordinate(value, min, max) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }

  function amapConfigured() {
    const config = window.AMAP_CONFIG || {};
    return Boolean(String(config.key || "").trim() && String(config.securityJsCode || "").trim());
  }

  function loadAmap() {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (!amapConfigured()) return Promise.reject(new Error("AMap is not configured"));
    if (amapLoadPromise) return amapLoadPromise;
    const config = window.AMAP_CONFIG;
    window._AMapSecurityConfig = { securityJsCode: String(config.securityJsCode).trim() };
    amapLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${AMAP_API_URL}&key=${encodeURIComponent(String(config.key).trim())}`;
      script.async = true;
      script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error("AMap did not initialize"));
      script.onerror = () => reject(new Error("AMap script failed to load"));
      document.head.appendChild(script);
    });
    return amapLoadPromise;
  }

  async function loadAmapPlaceSearch() {
    const AMap = await loadAmap();
    if (AMap.PlaceSearch) return AMap;
    await new Promise((resolve) => AMap.plugin("AMap.PlaceSearch", resolve));
    if (!AMap.PlaceSearch) throw new Error("AMap PlaceSearch is unavailable");
    return AMap;
  }

  async function loadAmapTransfer() {
    const AMap = await loadAmap();
    if (AMap.Transfer) return AMap;
    await new Promise((resolve) => AMap.plugin("AMap.Transfer", resolve));
    if (!AMap.Transfer) throw new Error("AMap Transfer is unavailable");
    return AMap;
  }

  async function loadAmapDriving() {
    const AMap = await loadAmap();
    if (AMap.Driving) return AMap;
    await new Promise((resolve) => AMap.plugin("AMap.Driving", resolve));
    if (!AMap.Driving) throw new Error("AMap Driving is unavailable");
    return AMap;
  }

  const COORD_PI = Math.PI;
  const COORD_A = 6378245;
  const COORD_EE = 0.00669342162296594323;

  function outsideChina(lng, lat) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  function transformLatitude(lng, lat) {
    let result = -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    result += (20 * Math.sin(6 * lng * COORD_PI) + 20 * Math.sin(2 * lng * COORD_PI)) * 2 / 3;
    result += (20 * Math.sin(lat * COORD_PI) + 40 * Math.sin(lat / 3 * COORD_PI)) * 2 / 3;
    result += (160 * Math.sin(lat / 12 * COORD_PI) + 320 * Math.sin(lat * COORD_PI / 30)) * 2 / 3;
    return result;
  }

  function transformLongitude(lng, lat) {
    let result = 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    result += (20 * Math.sin(6 * lng * COORD_PI) + 20 * Math.sin(2 * lng * COORD_PI)) * 2 / 3;
    result += (20 * Math.sin(lng * COORD_PI) + 40 * Math.sin(lng / 3 * COORD_PI)) * 2 / 3;
    result += (150 * Math.sin(lng / 12 * COORD_PI) + 300 * Math.sin(lng / 30 * COORD_PI)) * 2 / 3;
    return result;
  }

  function wgs84ToGcj02(lng, lat) {
    if (outsideChina(lng, lat)) return [lng, lat];
    let deltaLat = transformLatitude(lng - 105, lat - 35);
    let deltaLng = transformLongitude(lng - 105, lat - 35);
    const radLat = lat / 180 * COORD_PI;
    let magic = Math.sin(radLat);
    magic = 1 - COORD_EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    deltaLat = deltaLat * 180 / ((COORD_A * (1 - COORD_EE)) / (magic * sqrtMagic) * COORD_PI);
    deltaLng = deltaLng * 180 / (COORD_A / sqrtMagic * Math.cos(radLat) * COORD_PI);
    return [lng + deltaLng, lat + deltaLat];
  }

  function gcj02ToWgs84(lng, lat) {
    if (outsideChina(lng, lat)) return [lng, lat];
    const converted = wgs84ToGcj02(lng, lat);
    return [lng * 2 - converted[0], lat * 2 - converted[1]];
  }

  function loadFriendSyncSettings(storageKey = FRIEND_SYNC_STORAGE_KEY) {
    const fallback = { mySpace: null, subscriptions: [] };
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!stored || typeof stored !== "object") return fallback;
      return {
        mySpace: stored.mySpace && typeof stored.mySpace === "object" ? stored.mySpace : null,
        subscriptions: Array.isArray(stored.subscriptions)
          ? stored.subscriptions
              .filter((item) => item && typeof item.code === "string")
              .map((item) => ({
                code: item.code.trim().toUpperCase(),
                alias: String(item.alias || "").trim().slice(0, 24),
                displayName: String(item.displayName || "朋友").trim().slice(0, 24),
                updatedAt: Number(item.updatedAt) || null,
                cachedPoints: Array.isArray(item.cachedPoints) ? item.cachedPoints : []
              }))
          : []
      };
    } catch (error) {
      return fallback;
    }
  }

  function activeFriendStorageKey() {
    return authUser ? `${FRIEND_SYNC_STORAGE_KEY}.${authUser.id}` : FRIEND_SYNC_STORAGE_KEY;
  }

  function loadFriendSettingsForUser(userId) {
    const userKey = `${FRIEND_SYNC_STORAGE_KEY}.${userId}`;
    try {
      if (localStorage.getItem(userKey) !== null) return loadFriendSyncSettings(userKey);
    } catch (error) {
      return { mySpace: null, subscriptions: [] };
    }
    const legacy = loadFriendSyncSettings(FRIEND_SYNC_STORAGE_KEY);
    try { localStorage.setItem(userKey, JSON.stringify(legacy)); } catch (error) { /* no-op */ }
    return legacy;
  }

  function saveFriendSyncSettings() {
    try {
      localStorage.setItem(activeFriendStorageKey(), JSON.stringify(friendSyncSettings));
    } catch (error) {
      // Friend sync remains usable for the current session if storage is unavailable.
    }
  }

  function setFriendStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }

  function opaquePointId(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `point-${(hash >>> 0).toString(16)}`;
  }

  function ownSharedPoints() {
    return records.filter(isMappable).map((record) => ({
      id: opaquePointId(record.id),
      city: String(record.city || ""),
      lng: Number(Number(record.lng).toFixed(6)),
      lat: Number(Number(record.lat).toFixed(6))
    }));
  }

  async function friendApi(path, options = {}) {
    if (supabaseClient && authUser) {
      const method = String(options.method || "GET").toUpperCase();
      const codeMatch = path.match(/^\/api\/friend-spaces\/([A-Z0-9]+)$/i);
      if (method === "GET" && codeMatch) {
        const { data, error } = await supabaseClient.rpc("read_friend_space", { p_code: decodeURIComponent(codeMatch[1]) });
        if (error) throw new Error(error.message || "无法读取朋友点位。");
        if (!data) {
          const notFound = new Error("共享码不存在。");
          notFound.status = 404;
          throw notFound;
        }
        return data;
      }
    }
    if (!location.protocol.startsWith("http")) throw new Error("请通过“启动看板.command”打开，才能使用朋友同步。");
    const response = await fetch(new URL(path, location.origin), {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }
    if (!response.ok) {
      const requestError = new Error(payload.error || `同步服务返回 ${response.status}`);
      requestError.status = response.status;
      throw requestError;
    }
    return payload;
  }

  function friendTimestamp(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }

  async function saveCloudFriendSubscription(code, alias) {
    if (!supabaseClient || !authUser) return;
    const { error } = await supabaseClient.from("friend_subscriptions").upsert({
      user_id: authUser.id,
      friend_code: code,
      alias,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,friend_code" });
    if (error) throw error;
  }

  async function hydrateCloudFriendSettings() {
    if (!supabaseClient || !authUser) return;
    try {
      const [{ data: ownSpace, error: ownError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
        supabaseClient.from("friend_shares").select("code,display_name,updated_at,active").eq("owner_id", authUser.id).maybeSingle(),
        supabaseClient.from("friend_subscriptions").select("friend_code,alias").eq("user_id", authUser.id)
      ]);
      if (ownError) throw ownError;
      if (subscriptionsError) throw subscriptionsError;

      if (ownSpace?.active) {
        friendSyncSettings.mySpace = {
          code: ownSpace.code,
          provider: "supabase",
          displayName: ownSpace.display_name,
          updatedAt: friendTimestamp(ownSpace.updated_at),
          cloud: true
        };
      } else {
        friendSyncSettings.mySpace = null;
      }

      const cachedByCode = new Map(friendSyncSettings.subscriptions.map((item) => [item.code, item]));
      if (subscriptions?.length) {
        friendSyncSettings.subscriptions = subscriptions.map((item) => {
          const code = String(item.friend_code || "").toUpperCase();
          const cached = cachedByCode.get(code);
          return {
            code,
            alias: String(item.alias || cached?.alias || "").slice(0, 24),
            displayName: cached?.displayName || "朋友",
            updatedAt: cached?.updatedAt || null,
            cachedPoints: cached?.cachedPoints || []
          };
        });
      } else if (friendSyncSettings.subscriptions.length) {
        await Promise.all(friendSyncSettings.subscriptions.map((item) => saveCloudFriendSubscription(item.code, item.alias)));
      }
      saveFriendSyncSettings();
      rebuildFriendPointsFromCache();
      updateFriendDialog();
      await refreshFriendPoints();
    } catch (error) {
      // Keep the per-account browser cache available if friend tables have not been installed yet.
    }
  }

  function friendColorIndex(code = "") {
    let hash = 2166136261;
    for (const character of String(code)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % FRIEND_COLOR_PALETTE.length;
  }

  function friendColorForCode(code = "") {
    const codes = (friendSyncSettings?.subscriptions || []).map((subscription) => subscription.code);
    const targetIndex = codes.indexOf(code);
    if (targetIndex < 0) return FRIEND_COLOR_PALETTE[friendColorIndex(code)];
    const used = new Set();
    let assignedIndex = friendColorIndex(code);
    for (let index = 0; index <= targetIndex; index += 1) {
      assignedIndex = friendColorIndex(codes[index]);
      while (used.has(assignedIndex) && used.size < FRIEND_COLOR_PALETTE.length) {
        assignedIndex = (assignedIndex + 1) % FRIEND_COLOR_PALETTE.length;
      }
      used.add(assignedIndex);
    }
    return FRIEND_COLOR_PALETTE[assignedIndex];
  }

  function visibleFriendPoints() {
    const filter = els.friendFilter?.value || "all";
    if (filter === "none") return [];
    if (filter.startsWith("friend:")) {
      const shareCode = filter.slice("friend:".length);
      return friendPoints.filter((point) => point.shareCode === shareCode);
    }
    return friendPoints;
  }

  function refreshFriendFilter() {
    if (!els.friendFilter || !els.friendFilterField) return;
    const subscriptions = friendSyncSettings.subscriptions;
    const current = els.friendFilter.value || "all";
    const availableValues = new Set(["all", "none"]);
    const friendOptions = subscriptions.map((subscription) => {
      const value = `friend:${subscription.code}`;
      availableValues.add(value);
      const name = subscription.alias || subscription.displayName || "朋友";
      return `<option value="${escapeHtml(value)}">只看 ${escapeHtml(name)}</option>`;
    }).join("");
    els.friendFilter.innerHTML = `<option value="all">全部朋友</option><option value="none">隐藏朋友</option>${friendOptions}`;
    els.friendFilter.value = availableValues.has(current) ? current : "all";
    els.friendFilterField.hidden = subscriptions.length === 0;
    els.mapFilterGroup?.classList.toggle("has-friend-filter", subscriptions.length > 0);
    syncSystemSelect(els.friendFilter, true);
  }

  function renderFriendSubscriptions() {
    const subscriptions = friendSyncSettings.subscriptions;
    els.friendsCount.textContent = String(subscriptions.length);
    if (!subscriptions.length) {
      els.friendSubscriptions.innerHTML = '<p class="empty-note">还没有添加朋友。输入朋友分享的共享码即可看到点位。</p>';
      return;
    }
    els.friendSubscriptions.innerHTML = subscriptions.map((subscription) => {
      const count = Array.isArray(subscription.cachedPoints) ? subscription.cachedPoints.length : 0;
      const name = subscription.alias || subscription.displayName || "朋友";
      const updateLabel = subscription.updatedAt
        ? `已同步 ${count} 个点位 · ${new Date(subscription.updatedAt * 1000).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
        : `已保存共享码 · ${count} 个缓存点位`;
      return `
        <article class="friend-subscription" style="--friend-color:${friendColorForCode(subscription.code)}">
          <i aria-hidden="true"></i>
          <div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(updateLabel)}</small></div>
          <button type="button" data-friend-remove="${escapeHtml(subscription.code)}">移除</button>
        </article>`;
    }).join("");
  }

  function updateFriendDialog() {
    const mySpace = friendSyncSettings.mySpace;
    if (mySpace && !els.friendDisplayName.value) els.friendDisplayName.value = mySpace.displayName || "";
    els.friendShareCodeWrap.hidden = !mySpace?.code;
    els.friendShareCode.textContent = mySpace?.code || "—";
    els.friendPublish.textContent = mySpace?.code ? "更新共享点位" : "创建共享码";
    els.friendRevoke.hidden = !mySpace?.code;
    renderFriendSubscriptions();
  }

  function normalizeFriendPoint(point, subscription) {
    const lng = parseCoordinate(point?.lng, -180, 180);
    const lat = parseCoordinate(point?.lat, -90, 90);
    if (lng === null || lat === null) return null;
    return {
      id: `${subscription.code}:${String(point.id || `${lng},${lat}`)}`,
      shareCode: subscription.code,
      friendName: subscription.alias || subscription.displayName || "朋友",
      friendColor: friendColorForCode(subscription.code),
      city: String(point.city || ""),
      lng,
      lat
    };
  }

  function rebuildFriendPointsFromCache() {
    friendPoints = friendSyncSettings.subscriptions.flatMap((subscription) =>
      (subscription.cachedPoints || []).map((point) => normalizeFriendPoint(point, subscription)).filter(Boolean)
    );
    renderFriendSubscriptions();
    refreshFriendFilter();
    renderFriendMarkers();
    if (!els.routePanel.hidden) renderRoutePickerOptions(els.routePlaceQuery.value.trim());
  }

  async function publishOwnPoints({ silent = false } = {}) {
    const displayName = (els.friendDisplayName?.value || friendSyncSettings.mySpace?.displayName || "我").trim().slice(0, 24) || "我";
    const payload = { displayName, points: ownSharedPoints() };
    if (!silent) {
      els.friendPublish.disabled = true;
      setFriendStatus(els.friendPublishStatus, friendSyncSettings.mySpace?.code ? "正在更新共享点位…" : "正在创建共享码…");
    }
    try {
      if (supabaseClient && authUser) {
        const existingCode = friendSyncSettings.mySpace?.provider === "supabase" ? friendSyncSettings.mySpace.code : null;
        const { data: result, error } = await supabaseClient.rpc("upsert_my_friend_space", {
          p_display_name: displayName,
          p_points: payload.points,
          p_code: existingCode
        });
        if (error) throw error;
        friendSyncSettings.mySpace = {
          code: result.code,
          provider: "supabase",
          displayName,
          updatedAt: friendTimestamp(result.updatedAt)
        };
      } else if (friendSyncSettings.mySpace?.code && friendSyncSettings.mySpace?.ownerToken) {
        const mySpace = friendSyncSettings.mySpace;
        try {
          const result = await friendApi(`/api/friend-spaces/${encodeURIComponent(mySpace.code)}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${mySpace.ownerToken}` },
            body: JSON.stringify(payload)
          });
          friendSyncSettings.mySpace = { ...mySpace, displayName, updatedAt: result.updatedAt };
        } catch (error) {
          if (error.status !== 404) throw error;
          const recreated = await friendApi("/api/friend-spaces", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          friendSyncSettings.mySpace = {
            code: recreated.code,
            ownerToken: recreated.ownerToken,
            displayName,
            updatedAt: recreated.updatedAt
          };
        }
      } else {
        const result = await friendApi("/api/friend-spaces", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        friendSyncSettings.mySpace = {
          code: result.code,
          ownerToken: result.ownerToken,
          displayName,
          updatedAt: result.updatedAt
        };
      }
      saveFriendSyncSettings();
      updateFriendDialog();
      if (!silent) setFriendStatus(els.friendPublishStatus, `已同步 ${payload.points.length} 个点位。共享码只展示坐标。`);
    } catch (error) {
      if (!silent) setFriendStatus(els.friendPublishStatus, error.message || "共享点位失败。", true);
    } finally {
      if (!silent) els.friendPublish.disabled = false;
    }
  }

  function scheduleOwnPointPublish() {
    clearTimeout(friendPublishTimer);
    friendPublishTimer = setTimeout(() => publishOwnPoints({ silent: true }), 900);
  }

  async function revokeOwnPoints() {
    const mySpace = friendSyncSettings.mySpace;
    if (!mySpace?.code || (!mySpace.ownerToken && !(supabaseClient && authUser))) return;
    if (!window.confirm("停止共享后，这个共享码会立即失效，朋友端会在下次同步时移除你的点位。确定继续吗？")) return;
    els.friendRevoke.disabled = true;
    setFriendStatus(els.friendPublishStatus, "正在停止共享…");
    try {
      if (supabaseClient && authUser) {
        const { error } = await supabaseClient.rpc("revoke_my_friend_space", { p_code: mySpace.code });
        if (error) throw error;
      }
      else {
        await friendApi(`/api/friend-spaces/${encodeURIComponent(mySpace.code)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${mySpace.ownerToken}` }
        });
      }
      friendSyncSettings.mySpace = null;
      saveFriendSyncSettings();
      updateFriendDialog();
      setFriendStatus(els.friendPublishStatus, "共享已停止，原共享码已经失效。", false);
    } catch (error) {
      setFriendStatus(els.friendPublishStatus, error.message || "停止共享失败。", true);
    } finally {
      els.friendRevoke.disabled = false;
    }
  }

  async function refreshFriendPoints({ announce = false } = {}) {
    const subscriptions = friendSyncSettings.subscriptions;
    if (!subscriptions.length) {
      rebuildFriendPointsFromCache();
      if (announce) setFriendStatus(els.friendFollowStatus, "还没有添加朋友。先输入一个共享码。");
      return;
    }
    if (announce) {
      els.friendRefresh.disabled = true;
      setFriendStatus(els.friendFollowStatus, "正在同步朋友点位…");
    }
    let successCount = 0;
    let failureCount = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        const payload = await friendApi(`/api/friend-spaces/${encodeURIComponent(subscription.code)}`);
        subscription.displayName = String(payload.displayName || "朋友").slice(0, 24);
        subscription.updatedAt = friendTimestamp(payload.updatedAt);
        subscription.cachedPoints = Array.isArray(payload.points) ? payload.points : [];
        successCount += 1;
      } catch (error) {
        if (error.status === 404) {
          subscription.cachedPoints = [];
          subscription.updatedAt = null;
        }
        failureCount += 1;
      }
    }));
    saveFriendSyncSettings();
    rebuildFriendPointsFromCache();
    if (announce) {
      els.friendRefresh.disabled = false;
      const pointCount = friendPoints.length;
      setFriendStatus(
        els.friendFollowStatus,
        failureCount ? `已更新 ${successCount} 位朋友；${failureCount} 位暂时无法连接，继续显示缓存点位。` : `同步完成：${successCount} 位朋友，${pointCount} 个点位。`,
        successCount === 0 && failureCount > 0
      );
    }
  }

  async function addFriendSubscription() {
    const code = els.friendCodeInput.value.trim().toUpperCase();
    const alias = els.friendAliasInput.value.trim().slice(0, 24);
    if (!/^[A-Z0-9]{6,12}$/.test(code)) {
      setFriendStatus(els.friendFollowStatus, "请输入有效的 8 位共享码。", true);
      els.friendCodeInput.focus();
      return;
    }
    if (code === friendSyncSettings.mySpace?.code) {
      setFriendStatus(els.friendFollowStatus, "这是你自己的共享码，不需要重复添加。", true);
      return;
    }
    els.friendAdd.disabled = true;
    setFriendStatus(els.friendFollowStatus, "正在验证共享码…");
    try {
      const payload = await friendApi(`/api/friend-spaces/${encodeURIComponent(code)}`);
      const existing = friendSyncSettings.subscriptions.find((item) => item.code === code);
      const subscription = {
        code,
        alias: alias || existing?.alias || "",
        displayName: String(payload.displayName || existing?.displayName || "朋友").slice(0, 24),
        updatedAt: friendTimestamp(payload.updatedAt),
        cachedPoints: Array.isArray(payload.points) ? payload.points : []
      };
      friendSyncSettings.subscriptions = existing
        ? friendSyncSettings.subscriptions.map((item) => item.code === code ? subscription : item)
        : [...friendSyncSettings.subscriptions, subscription];
      if (supabaseClient && authUser) await saveCloudFriendSubscription(code, subscription.alias);
      saveFriendSyncSettings();
      els.friendCodeInput.value = "";
      els.friendAliasInput.value = "";
      rebuildFriendPointsFromCache();
      setFriendStatus(els.friendFollowStatus, `已添加 ${subscription.alias || subscription.displayName}，同步到 ${subscription.cachedPoints.length} 个点位。`);
    } catch (error) {
      setFriendStatus(els.friendFollowStatus, error.message || "无法添加这个共享码。", true);
    } finally {
      els.friendAdd.disabled = false;
    }
  }

  function removeFriendSubscription(code) {
    const subscription = friendSyncSettings.subscriptions.find((item) => item.code === code);
    if (!subscription || !window.confirm(`移除“${subscription.alias || subscription.displayName || "朋友"}”的共享点位？`)) return;
    friendSyncSettings.subscriptions = friendSyncSettings.subscriptions.filter((item) => item.code !== code);
    if (supabaseClient && authUser) {
      supabaseClient.from("friend_subscriptions").delete().eq("user_id", authUser.id).eq("friend_code", code).then(({ error }) => {
        if (error) setFriendStatus(els.friendFollowStatus, "已从本机移除；云端同步稍后重试。", true);
      });
    }
    saveFriendSyncSettings();
    rebuildFriendPointsFromCache();
    setFriendStatus(els.friendFollowStatus, "已移除朋友点位。", false);
  }

  function openFriendsDialog() {
    updateFriendDialog();
    if (typeof els.friendsDialog.showModal === "function") els.friendsDialog.showModal();
    else els.friendsDialog.setAttribute("open", "");
    refreshFriendPoints({ announce: true });
  }

  function closeFriendsDialog() {
    if (typeof els.friendsDialog.close === "function") els.friendsDialog.close();
    else els.friendsDialog.removeAttribute("open");
  }

  function visibleRecords() {
    const stage = els.stageFilter.value;
    const city = els.cityFilter.value;
    const preference = els.locationFilter.value;
    return records
      .filter((record) => stage === "all" || record.stage === stage)
      .filter((record) => city === "all" || record.city === city)
      .filter((record) => preference === "all" || record.locationPreference === preference)
      .sort((a, b) => {
        const priorityDelta = (priorityMeta[b.priority]?.score || 0) - (priorityMeta[a.priority]?.score || 0);
        if (priorityDelta) return priorityDelta;
        const placeDelta = (preferenceMeta[b.locationPreference]?.score || 0) - (preferenceMeta[a.locationPreference]?.score || 0);
        if (placeDelta) return placeDelta;
        return String(nextIncompleteEvent(a)?.date || "9999").localeCompare(String(nextIncompleteEvent(b)?.date || "9999"));
      });
  }

  function refreshCityFilter() {
    const current = els.cityFilter.value;
    const cities = [...new Set(records.map((record) => record.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    els.cityFilter.innerHTML = `<option value="all">全部城市</option>${cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join("")}`;
    els.cityFilter.value = cities.includes(current) ? current : "all";
    syncSystemSelect(els.cityFilter, true);
  }

  function closeSystemSelect(select, { restoreFocus = false } = {}) {
    const ui = systemSelectRegistry.get(select);
    if (!ui) return;
    ui.shell.classList.remove("is-open");
    ui.trigger.setAttribute("aria-expanded", "false");
    ui.menu.hidden = true;
    if (select.matches("[data-application-stage]")) {
      ui.menu.style.removeProperty("position");
      ui.menu.style.removeProperty("top");
      ui.menu.style.removeProperty("left");
      ui.menu.style.removeProperty("width");
      ui.menu.style.removeProperty("z-index");
    }
    if (restoreFocus) ui.trigger.focus({ preventScroll: true });
  }

  function closeOtherSystemSelects(activeSelect = null) {
    systemSelectRegistry.forEach((ui, select) => {
      if (select !== activeSelect) closeSystemSelect(select);
    });
  }

  function systemSelectOptions(select) {
    const ui = systemSelectRegistry.get(select);
    return ui ? [...ui.menu.querySelectorAll("[data-system-select-value]")] : [];
  }

  function focusSystemSelectOption(select, direction) {
    const ui = systemSelectRegistry.get(select);
    const options = systemSelectOptions(select);
    if (!ui || !options.length) return;
    const currentIndex = options.indexOf(document.activeElement);
    let targetIndex = currentIndex;
    if (direction === "first") targetIndex = 0;
    else if (direction === "last") targetIndex = options.length - 1;
    else if (direction === "next") targetIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % options.length;
    else if (direction === "previous") targetIndex = currentIndex < 0 ? options.length - 1 : (currentIndex - 1 + options.length) % options.length;
    options[targetIndex]?.focus({ preventScroll: true });
  }

  function openSystemSelect(select, { focusSelected = false } = {}) {
    const ui = systemSelectRegistry.get(select);
    if (!ui) return;
    closeOtherSystemSelects(select);
    ui.shell.classList.add("is-open");
    ui.trigger.setAttribute("aria-expanded", "true");
    ui.menu.hidden = false;
    if (select.matches("[data-application-stage]")) {
      const triggerRect = ui.trigger.getBoundingClientRect();
      const menuWidth = Math.max(172, triggerRect.width);
      const estimatedHeight = Math.min(292, select.options.length * 45 + 12);
      const openAbove = window.innerHeight - triggerRect.bottom < estimatedHeight + 16 && triggerRect.top > estimatedHeight + 16;
      const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - menuWidth - 8);
      const top = openAbove
        ? Math.max(8, triggerRect.top - estimatedHeight - 7)
        : Math.min(window.innerHeight - estimatedHeight - 8, triggerRect.bottom + 7);
      Object.assign(ui.menu.style, {
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        width: `${menuWidth}px`,
        zIndex: "1200"
      });
    }
    if (focusSelected) {
      const selectedOption = ui.menu.querySelector('[aria-selected="true"]');
      (selectedOption || systemSelectOptions(select)[0])?.focus({ preventScroll: true });
    }
  }

  function chooseSystemSelectValue(select, value) {
    if (![...select.options].some((option) => option.value === value)) return;
    select.value = value;
    syncSystemSelect(select);
    closeSystemSelect(select, { restoreFocus: true });
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function syncSystemSelect(select, rebuild = false) {
    const ui = systemSelectRegistry.get(select);
    if (!ui) return;
    if (rebuild || ui.menu.childElementCount !== select.options.length) {
      ui.menu.replaceChildren();
      [...select.options].forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "system-select-option";
        button.dataset.systemSelectValue = option.value;
        button.setAttribute("role", "option");

        const indicator = document.createElement("span");
        indicator.className = "system-select-option-indicator";
        indicator.setAttribute("aria-hidden", "true");
        const text = document.createElement("span");
        text.className = "system-select-option-text";
        text.textContent = option.textContent;
        button.append(indicator, text);
        ui.menu.append(button);
      });
    }
    const selected = select.options[select.selectedIndex] || select.options[0];
    ui.value.textContent = selected?.textContent || "请选择";
    systemSelectOptions(select).forEach((option) => {
      option.setAttribute("aria-selected", String(option.dataset.systemSelectValue === select.value));
    });
  }

  function initializeSystemSelect(select) {
    if (!select || systemSelectRegistry.has(select)) return;
    const field = select.closest(".field");
    const fieldLabel = field?.querySelector(".field-label");
    const inlineLabel = [...(field?.childNodes || [])]
      .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      ?.textContent.trim();
    const shell = document.createElement("div");
    shell.className = "system-select";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "system-select-trigger";
    trigger.id = `${select.id}-trigger`;
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    if (fieldLabel?.id) trigger.setAttribute("aria-labelledby", `${fieldLabel.id} ${trigger.id}`);
    else trigger.setAttribute("aria-label", select.getAttribute("aria-label") || inlineLabel || "请选择");
    if (select.getAttribute("aria-describedby")) trigger.setAttribute("aria-describedby", select.getAttribute("aria-describedby"));

    const value = document.createElement("span");
    value.className = "system-select-value";
    const caret = document.createElement("span");
    caret.className = "system-select-caret";
    caret.setAttribute("aria-hidden", "true");
    caret.append(document.createElement("i"));
    trigger.append(value, caret);

    const menu = document.createElement("div");
    menu.className = "system-select-menu";
    menu.id = `${select.id}-menu`;
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-labelledby", fieldLabel?.id || trigger.id);
    menu.hidden = true;
    trigger.setAttribute("aria-controls", menu.id);

    select.classList.add("system-select-native");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
    select.insertAdjacentElement("afterend", shell);
    shell.append(trigger, menu);
    systemSelectRegistry.set(select, { shell, trigger, value, menu });
    syncSystemSelect(select, true);

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      if (shell.classList.contains("is-open")) closeSystemSelect(select);
      else openSystemSelect(select);
    });
    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openSystemSelect(select, { focusSelected: true });
      }
      if (event.key === "Escape") closeSystemSelect(select);
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-system-select-value]");
      if (option) {
        event.preventDefault();
        chooseSystemSelectValue(select, option.dataset.systemSelectValue);
      }
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusSystemSelectOption(select, "next");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusSystemSelectOption(select, "previous");
      } else if (event.key === "Home") {
        event.preventDefault();
        focusSystemSelectOption(select, "first");
      } else if (event.key === "End") {
        event.preventDefault();
        focusSystemSelectOption(select, "last");
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeSystemSelect(select, { restoreFocus: true });
      }
    });
    shell.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!shell.contains(document.activeElement)) closeSystemSelect(select);
      }, 0);
    });
  }

  function initializeSystemSelects() {
    document.querySelectorAll("select").forEach(initializeSystemSelect);
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".system-select")) closeOtherSystemSelects();
    });
  }

  function formatShortDate(date) {
    const value = parseDate(date);
    return `${value.getMonth() + 1}/${value.getDate()}`;
  }

  function renderInsights() {
    const visible = visibleRecords();
    const stageEntries = Object.entries(statusMeta).map(([key, meta]) => ({
      key,
      label: meta.label,
      count: visible.filter((record) => record.stage === key).length
    }));
    const total = visible.length;
    els.pipelineTotal.textContent = `${total} 条`;
    els.stageChart.innerHTML = `
      <div class="stage-flow" role="img" aria-label="${escapeHtml(stageEntries.map((item) => `${item.label} ${item.count} 条`).join("，"))}">
        ${stageEntries.map((item) => `<span class="stage-flow-segment stage-${item.key}" style="--share:${total ? item.count / total * 100 : 0}%" aria-hidden="true"></span>`).join("")}
      </div>
      <div class="stage-flow-labels">
        ${stageEntries.map((item) => `
          <span><i class="status-dot stage-${item.key}"></i><b>${item.count}</b><small>${escapeHtml(item.label)}</small></span>`).join("")}
      </div>`;

    const cityMap = new Map();
    visible.forEach((record) => {
      const city = record.city || "城市待确认";
      const current = cityMap.get(city) || { city, count: 0, love: 0 };
      current.count += 1;
      if (record.locationPreference === "love") current.love += 1;
      cityMap.set(city, current);
    });
    const cities = [...cityMap.values()]
      .sort((a, b) => b.count - a.count || b.love - a.love || a.city.localeCompare(b.city, "zh-CN"));
    const maxCityCount = Math.max(1, ...cities.map((item) => item.count));
    els.cityChart.innerHTML = cities.length ? cities.map((item) => `
      <div class="city-chart-row">
        <div class="city-chart-label"><strong>${escapeHtml(item.city)}</strong><span>${item.count} 岗 · ${item.love} 个很想去</span></div>
        <div class="city-chart-track" role="img" aria-label="${escapeHtml(item.city)} ${item.count} 个岗位，其中 ${item.love} 个很想去">
          <span class="city-chart-volume" style="--volume:${item.count / maxCityCount * 100}%">
            <i style="--love:${item.count ? item.love / item.count * 100 : 0}%"></i>
          </span>
        </div>
      </div>`).join("") : '<p class="chart-empty">当前筛选下没有城市数据</p>';

    if (!els.deadlineSummary || !els.deadlineChart) return;

    const visibleActive = visible.filter((record) => record.stage !== "ended");
    const activeEvents = recordEvents(visibleActive).filter(({ event }) => !event.completed && event.date);
    const overdue = activeEvents.filter(({ event }) => event.date < today()).length;
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = parseDate(today());
      date.setDate(date.getDate() + index);
      const currentDate = dateKey(date);
      const events = activeEvents.filter(({ event }) => event.date === currentDate);
      const categories = Object.keys(eventCategoryMeta).map((category) => ({
        category,
        count: events.filter(({ event }) => eventCategory(event.type) === category).length
      })).filter((item) => item.count);
      return {
        date: currentDate,
        weekday: index === 0 ? "今天" : `周${"日一二三四五六"[date.getDay()]}`,
        count: events.length,
        categories
      };
    });
    const maxDayCount = Math.max(1, ...days.map((day) => day.count));
    els.deadlineSummary.textContent = overdue ? `${overdue} 个逾期` : "没有逾期";
    els.deadlineSummary.classList.toggle("overdue", overdue > 0);
    const usedCategories = Object.keys(eventCategoryMeta).filter((category) => days.some((day) => day.categories.some((item) => item.category === category)));
    els.deadlineChart.innerHTML = `
      <div class="deadline-legend" aria-label="日程类型图例">
        ${(usedCategories.length ? usedCategories : ["assessment", "interview", "deadline"]).map((category) => `<span><i class="event-dot event-${category}"></i>${escapeHtml(eventCategoryMeta[category].label)}</span>`).join("")}
      </div>
      <div class="deadline-days">
        ${days.map((day) => {
          const categorySummary = day.categories.map((item) => `${eventCategoryMeta[item.category].label} ${item.count} 个`).join("，");
          return `
            <button class="deadline-day" type="button" data-calendar-open-date="${day.date}" aria-label="${escapeHtml(day.weekday)} ${formatShortDate(day.date)}，${day.count} 个日程${categorySummary ? `：${escapeHtml(categorySummary)}` : ""}">
              <span class="deadline-count">${day.count || "·"}</span>
              <span class="deadline-bar" aria-hidden="true">
                ${day.categories.map((item) => `<i class="deadline-segment event-${item.category}" style="--segment-size:${item.count / maxDayCount * 100}%"></i>`).join("")}
              </span>
              <strong>${escapeHtml(day.weekday)}</strong>
              <small>${formatShortDate(day.date)}</small>
            </button>`;
        }).join("")}
      </div>`;
  }

  function findCalendarEvent(jobId, eventId) {
    const record = records.find((item) => item.id === jobId);
    const event = record?.events?.find((item) => item.id === eventId) || null;
    return { record, event };
  }

  function renderAgenda() {
    const allEvents = recordEvents();
    let agenda = [];
    let focusedAgendaItem = null;
    if (calendarAgendaMode === "event" && calendarFocusedEventRef) {
      const focused = findCalendarEvent(calendarFocusedEventRef.jobId, calendarFocusedEventRef.eventId);
      focusedAgendaItem = focused.record && focused.event ? focused : null;
      if (!focusedAgendaItem) {
        calendarAgendaMode = "all";
        calendarFocusedEventRef = null;
      }
    }
    if (calendarAgendaMode === "date") {
      agenda = allEvents.filter(({ event }) => event.date === calendarSelectedDate);
    } else if (calendarAgendaMode === "event") {
      agenda = allEvents.filter(({ event, record }) => !event.completed && record.stage !== "ended");
      if (focusedAgendaItem && !agenda.some(({ event, record }) => event.id === focusedAgendaItem.event.id && record.id === focusedAgendaItem.record.id)) {
        agenda.push(focusedAgendaItem);
      }
    } else if (calendarAgendaMode === "all") {
      agenda = allEvents.filter(({ event, record }) => !event.completed && record.stage !== "ended");
    }
    agenda.sort((left, right) => compareEvents(left.event, right.event));

    els.agendaKicker.textContent = calendarAgendaMode === "all"
      ? "OPEN AGENDA"
      : calendarAgendaMode === "event" ? "SELECTED DATE" : "DAY AGENDA";
    els.agendaDateLabel.textContent = calendarAgendaMode === "all"
      ? `全部进行中 · ${agenda.length} 项`
      : formatCalendarDate(calendarSelectedDate);
    els.agendaShowAll.hidden = calendarAgendaMode !== "date";

    if (!agenda.length) {
      els.agendaList.innerHTML = calendarAgendaMode === "date"
        ? '<p class="agenda-empty">这一天还没有日程。<br>请在对应岗位记录中填写客观时间节点。</p>'
        : '<p class="agenda-empty">没有进行中的日程。<br>请在对应岗位记录中填写客观时间节点。</p>';
      return;
    }
    els.agendaList.innerHTML = agenda.map(({ event, record }) => {
      const meta = [event.location, event.notes].filter(Boolean).join(" · ");
      const category = eventCategory(event.type);
      const showDate = calendarAgendaMode !== "date";
      const timing = `${showDate ? `${formatDate(event.date)} · ` : ""}${eventTimeLabel(event)}`;
      const isFocused = calendarAgendaMode === "event"
        && calendarFocusedEventRef?.jobId === record.id
        && calendarFocusedEventRef?.eventId === event.id;
      return `
        <article class="agenda-event${event.completed ? " is-completed" : ""}${isFocused ? " is-focused" : ""}" data-category="${category}">
          <div class="agenda-event-heading">
            <button class="agenda-event-title" type="button" data-event-action="focus" data-job-id="${escapeHtml(record.id)}" data-event-id="${escapeHtml(event.id)}" aria-pressed="${isFocused}">${escapeHtml(event.title)}</button>
            <span class="agenda-event-time">${escapeHtml(timing)}</span>
          </div>
          <p class="agenda-event-job"><i class="event-dot event-${category}"></i>${escapeHtml(record.company)} · ${escapeHtml(record.role)} · ${escapeHtml(eventTypeMeta[event.type]?.label || "日程")}</p>
          ${meta ? `<p class="agenda-event-meta">${escapeHtml(meta)}</p>` : ""}
          <div class="agenda-event-actions" aria-label="日程操作">
            <button type="button" data-event-action="toggle" data-job-id="${escapeHtml(record.id)}" data-event-id="${escapeHtml(event.id)}">${event.completed ? "恢复" : "完成"}</button>
            <button type="button" data-event-action="edit" data-job-id="${escapeHtml(record.id)}" data-event-id="${escapeHtml(event.id)}">编辑</button>
            <button type="button" data-event-action="delete" data-job-id="${escapeHtml(record.id)}" data-event-id="${escapeHtml(event.id)}">删除</button>
          </div>
        </article>`;
    }).join("");
  }

  function renderCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    els.calendarMonthLabel.textContent = `${year}年${month + 1}月`;

    const first = new Date(year, month, 1, 12);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayOffset, 12);
    const eventsByDate = new Map();
    recordEvents().forEach((item) => {
      if (!item.event.date) return;
      const current = eventsByDate.get(item.event.date) || [];
      current.push(item);
      eventsByDate.set(item.event.date, current);
    });

    els.calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
      const value = new Date(gridStart);
      value.setDate(gridStart.getDate() + index);
      const currentDate = dateKey(value);
      const events = eventsByDate.get(currentDate) || [];
      const categories = [...new Set(events.map(({ event }) => eventCategory(event.type)))].slice(0, 4);
      const isOutside = value.getMonth() !== month;
      const className = `calendar-day${isOutside ? " is-outside" : ""}${currentDate === today() ? " is-today" : ""}`;
      const eventDescription = events.length ? `，${events.length} 个日程` : "，没有日程";
      return `
          <button class="${className}" type="button" role="gridcell" data-calendar-date="${currentDate}" aria-selected="${calendarAgendaMode !== "all" && currentDate === calendarSelectedDate}" aria-label="${value.getMonth() + 1}月${value.getDate()}日${eventDescription}">
          <span class="calendar-day-number">${value.getDate()}</span>
          <span class="calendar-day-events" aria-hidden="true">
            ${categories.map((category) => `<i class="event-dot event-${category}"></i>`).join("")}
            ${events.length ? `<small class="calendar-day-count">${events.length}</small>` : ""}
          </span>
        </button>`;
    }).join("");
    renderAgenda();
  }

  function openCalendar(date = null, trigger = null) {
    calendarAgendaMode = date ? "date" : "all";
    calendarFocusedEventRef = null;
    calendarSelectedDate = date || today();
    calendarCursor = parseDate(calendarSelectedDate) || parseDate(today());
    calendarCursor.setDate(1);
    closeEventForm();
    renderCalendar();
    window.clearTimeout(calendarClosingTimer);
    if (trigger instanceof Element) calendarTriggerElement = trigger;
    else if (!(calendarTriggerElement instanceof Element)) calendarTriggerElement = els.overviewCalendarButton;
    els.calendarDialog.classList.remove("is-opening", "is-minimizing");
    if (typeof els.calendarDialog.showModal === "function") els.calendarDialog.showModal();
    else els.calendarDialog.setAttribute("open", "");
    window.requestAnimationFrame(() => {
      els.calendarDialog.classList.add("is-opening");
      calendarClosingTimer = window.setTimeout(() => els.calendarDialog.classList.remove("is-opening"), 270);
    });
  }

  function finishCalendarClose() {
    window.clearTimeout(calendarClosingTimer);
    els.calendarDialog.classList.remove("is-opening", "is-minimizing");
    closeEventForm();
    if (typeof els.calendarDialog.close === "function") els.calendarDialog.close();
    else els.calendarDialog.removeAttribute("open");
    calendarTriggerElement?.focus?.({ preventScroll: true });
  }

  function closeCalendar() {
    if (!els.calendarDialog.open || els.calendarDialog.classList.contains("is-minimizing")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishCalendarClose();
      return;
    }
    els.calendarDialog.classList.remove("is-opening");
    els.calendarDialog.classList.add("is-minimizing");
    calendarClosingTimer = window.setTimeout(finishCalendarClose, 200);
  }

  function populateEventJobOptions(selectedJobId) {
    const options = [...records]
      .sort((left, right) => `${left.company}${left.role}`.localeCompare(`${right.company}${right.role}`, "zh-CN"))
      .map((record) => `<option value="${escapeHtml(record.id)}">${escapeHtml(record.company)} · ${escapeHtml(record.role)}</option>`)
      .join("");
    els.eventJob.innerHTML = options;
    if (records.some((record) => record.id === selectedJobId)) els.eventJob.value = selectedJobId;
    syncSystemSelect(els.eventJob, true);
  }

  function openEventForm(jobId, eventId) {
    const { record, event } = findCalendarEvent(jobId, eventId);
    if (!record || !event) return;
    editingEventRef = { jobId: record.id, eventId: event.id };
    els.eventForm.reset();
    els.eventFormError.textContent = "";
    els.eventFormTitle.textContent = "编辑日程";
    populateEventJobOptions(record.id);
    els.eventId.value = event.id;
    els.eventType.value = event.type;
    syncSystemSelect(els.eventType);
    els.eventDate.value = event.date;
    els.eventStartTime.value = event.startTime;
    els.eventEndTime.value = event.endTime;
    els.eventTitle.value = event.title;
    els.eventLocation.value = event.location;
    els.eventNotes.value = event.notes;
    els.eventForm.hidden = false;
    systemSelectRegistry.get(els.eventJob)?.trigger.focus({ preventScroll: true });
  }

  function closeEventForm() {
    editingEventRef = null;
    els.eventForm.hidden = true;
    els.eventFormError.textContent = "";
  }

  function handleEventSave() {
    els.eventFormError.textContent = "";
    if (!els.eventForm.checkValidity()) {
      els.eventForm.reportValidity();
      return;
    }
    const data = Object.fromEntries(new FormData(els.eventForm).entries());
    if (data.type === "interview" && !data.startTime) {
      els.eventFormError.textContent = "面试日程需要填写具体开始时间。";
      els.eventStartTime.focus();
      return;
    }
    if (data.startTime && data.endTime && data.endTime <= data.startTime) {
      els.eventFormError.textContent = "结束时间需要晚于开始时间。";
      els.eventEndTime.focus();
      return;
    }
    const targetRecord = records.find((record) => record.id === data.jobId);
    if (!targetRecord) {
      els.eventFormError.textContent = "请先选择一个关联岗位。";
      return;
    }

    const previous = editingEventRef ? findCalendarEvent(editingEventRef.jobId, editingEventRef.eventId) : { record: null, event: null };
    const schedule = normalizeEvent({
      ...(previous.event || {}),
      id: previous.event?.id || makeEventId(),
      type: data.type,
      title: data.title.trim() || eventTypeMeta[data.type].label,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location.trim(),
      notes: data.notes.trim(),
      source: "manual"
    });

    if (previous.record) previous.record.events = previous.record.events.filter((event) => event.id !== schedule.id);
    targetRecord.events = [...(targetRecord.events || []).filter((event) => event.id !== schedule.id), schedule];
    const affected = [...new Set([previous.record, targetRecord].filter(Boolean))];
    affected.forEach(touchRecordSchedule);
    calendarSelectedDate = schedule.date;
    calendarAgendaMode = "event";
    calendarFocusedEventRef = { jobId: targetRecord.id, eventId: schedule.id };
    calendarCursor = parseDate(schedule.date);
    calendarCursor.setDate(1);
    saveRecords();
    closeEventForm();
    render();
    renderCalendar();
  }

  function toggleCalendarEvent(jobId, eventId) {
    const { record, event } = findCalendarEvent(jobId, eventId);
    if (!record || !event) return;
    event.completed = !event.completed;
    touchRecordSchedule(record);
    saveRecords();
    render();
    renderCalendar();
  }

  function deleteCalendarEvent(jobId, eventId) {
    const { record, event } = findCalendarEvent(jobId, eventId);
    if (!record || !event || !window.confirm(`删除“${event.title}”日程？`)) return;
    record.events = record.events.filter((item) => item.id !== eventId);
    touchRecordSchedule(record);
    if (calendarFocusedEventRef?.eventId === eventId) {
      calendarAgendaMode = "all";
      calendarFocusedEventRef = null;
    }
    saveRecords();
    closeEventForm();
    render();
    renderCalendar();
  }

  function renderList() {
    const visible = visibleRecords();
    els.listCount.textContent = `${visible.length} 条记录`;
    if (!visible.length) {
      els.list.innerHTML = '<p class="empty-note">当前筛选下没有记录</p>';
      return;
    }
    els.list.innerHTML = visible.map((record) => {
      const status = statusMeta[record.stage]?.label || record.stage;
      const preference = preferenceMeta[record.locationPreference]?.label || "未设置";
      const priority = priorityMeta[record.priority]?.label || "未设置";
      const schedule = nextIncompleteEvent(record);
      const due = dateState(schedule?.date);
      const accuracy = record.accuracy === "unknown" ? " · 地址待确认" : "";
      return `
        <button class="record-card" type="button" data-record-id="${escapeHtml(record.id)}" data-stage="${escapeHtml(record.stage)}" aria-pressed="${record.id === selectedId}">
          <span class="record-top">
            <span class="record-title">${escapeHtml(record.company)} · ${escapeHtml(record.role)}</span>
            <span class="record-status"><i class="status-dot stage-${escapeHtml(record.stage)}"></i>${escapeHtml(status)}</span>
          </span>
          <span class="record-address"><strong>${escapeHtml(record.building || "办公楼待确认")}</strong><br>${escapeHtml(record.address || `${record.city || "Base"} · 具体地址待确认`)}</span>
          <span class="record-meta"><span>偏好：${escapeHtml(preference)}</span><span>优先级：${escapeHtml(priority)}${accuracy}</span></span>
          <span class="record-schedule ${due.overdue ? "overdue" : ""}">${schedule ? `${escapeHtml(formatDate(schedule.date))} · ${escapeHtml(schedule.title)}` : "暂无进行中日程"}</span>
        </button>`;
    }).join("");
  }

  function selectedVisibleRecord() {
    const visible = visibleRecords();
    return visible.find((record) => record.id === selectedId) || visible[0] || null;
  }

  function endpointFromRecord(record) {
    if (!record || !isMappable(record)) return null;
    return {
      kind: "job",
      id: record.id,
      label: `${record.company} · ${record.role}`,
      subtitle: [record.building, record.city].filter(Boolean).join(" · "),
      city: record.city || "",
      lng: Number(record.lng),
      lat: Number(record.lat)
    };
  }

  function endpointFromFriend(point) {
    if (!point) return null;
    return {
      kind: "friend",
      id: point.id,
      label: `${point.friendName || "朋友"} · 朋友点位`,
      subtitle: point.city || "仅共享坐标",
      city: point.city || "",
      lng: Number(point.lng),
      lat: Number(point.lat)
    };
  }

  function endpointFromPlace(feature) {
    const [providerLng, providerLat] = feature?.geometry?.coordinates?.map(Number) || [];
    if (!Number.isFinite(providerLng) || !Number.isFinite(providerLat)) return null;
    const properties = feature.properties || {};
    const isAmap = properties.provider === "amap";
    const [lng, lat] = isAmap ? gcj02ToWgs84(providerLng, providerLat) : [providerLng, providerLat];
    return {
      kind: "place",
      id: placeKey(feature),
      label: placeName(feature),
      subtitle: formatPlaceAddress(properties) || "地图地点",
      city: formatPlaceCity(properties) || "",
      lng,
      lat
    };
  }

  function routeEndpointKey(endpoint) {
    return endpoint ? `${endpoint.kind}:${endpoint.id}` : "";
  }

  function renderRouteEndpoints() {
    const renderButton = (button, endpoint, emptyTitle, emptySubtitle) => {
      button.querySelector("strong").textContent = endpoint?.label || emptyTitle;
      button.querySelector("small").textContent = endpoint?.subtitle || emptySubtitle;
    };
    renderButton(els.routeOrigin, routeOrigin, "选择起点", "我的岗位、朋友点位或任意地点");
    renderButton(els.routeDestination, routeDestination, "选择终点", "搜索写字楼、地铁站或地点");
    els.routeOrigin.classList.toggle("is-active", !els.routePicker.hidden && routePickerTarget === "origin");
    els.routeDestination.classList.toggle("is-active", !els.routePicker.hidden && routePickerTarget === "destination");
    els.routeSubmit.disabled = !(routeOrigin && routeDestination);
    if (!routePlans.length) {
      els.routeStatus.textContent = routeOrigin && routeDestination
        ? routeTravelMeta[routeTravelMode].ready
        : "先选择起点和终点。";
    }
  }

  function setRouteTravelMode(mode) {
    routeTravelMode = mode === "driving" ? "driving" : "transit";
    routePlans = [];
    selectedRoutePlanIndex = 0;
    els.routeModeSwitch.querySelectorAll("[data-route-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.routeMode === routeTravelMode));
    });
    const meta = routeTravelMeta[routeTravelMode];
    els.routeEyebrow.textContent = meta.eyebrow;
    els.routeTitle.textContent = meta.title;
    els.routeSubmit.textContent = meta.submit;
    els.routeResults.innerHTML = "";
    clearRouteOnMap();
    renderRouteEndpoints();
  }

  function localRouteEndpoints(query = "") {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    const own = records
      .filter(isMappable)
      .map(endpointFromRecord)
      .filter((endpoint) => !normalized || `${endpoint.label}${endpoint.subtitle}${endpoint.city}`.toLocaleLowerCase("zh-CN").includes(normalized));
    const friends = friendPoints
      .map(endpointFromFriend)
      .filter((endpoint) => !normalized || `${endpoint.label}${endpoint.subtitle}${endpoint.city}`.toLocaleLowerCase("zh-CN").includes(normalized));
    return { own, friends };
  }

  function renderRoutePickerOptions(query = "", placeFeatures = []) {
    const { own, friends } = localRouteEndpoints(query);
    const places = placeFeatures.map(endpointFromPlace).filter(Boolean);
    routePickerOptions = [];
    const sections = [];
    const addSection = (label, endpoints) => {
      if (!endpoints.length) return;
      const startIndex = routePickerOptions.length;
      routePickerOptions.push(...endpoints);
      sections.push(`
        <p class="route-picker-group">${escapeHtml(label)}</p>
        ${endpoints.map((endpoint, offset) => `
          <button class="route-picker-option" type="button" role="option" data-route-option-index="${startIndex + offset}" data-kind="${escapeHtml(endpoint.kind)}">
            <i aria-hidden="true"></i>
            <div><strong>${escapeHtml(endpoint.label)}</strong><small>${escapeHtml(endpoint.subtitle || endpoint.city || "地图点位")}</small></div>
          </button>`).join("")}`);
    };
    addSection("我的岗位", own);
    addSection("朋友点位", friends);
    addSection("地点搜索", places);
    els.routePickerResults.innerHTML = sections.length
      ? sections.join("")
      : `<p class="empty-note">${query.length >= 2 ? "没有匹配地点，请补充城市后重试。" : "输入地点名称搜索，或从现有点位中选择。"}</p>`;
  }

  function openRoutePicker(target) {
    routePickerTarget = target === "origin" ? "origin" : "destination";
    els.routePicker.hidden = false;
    els.routePickerTargetLabel.textContent = routePickerTarget === "origin" ? "起点" : "终点";
    els.routePlaceQuery.value = "";
    renderRoutePickerOptions();
    renderRouteEndpoints();
    els.routePlaceQuery.focus({ preventScroll: true });
  }

  function chooseRouteEndpoint(endpoint) {
    if (!endpoint) return;
    if (routePickerTarget === "origin") routeOrigin = endpoint;
    else routeDestination = endpoint;
    els.routePicker.hidden = true;
    routePlans = [];
    selectedRoutePlanIndex = 0;
    els.routeResults.innerHTML = "";
    clearRouteOnMap();
    renderRouteEndpoints();
  }

  async function searchRoutePlaces(rawQuery) {
    const query = rawQuery.trim();
    const requestId = ++routePlaceSearchRequestId;
    routePlaceSearchController?.abort();
    if (query.length < 2) {
      renderRoutePickerOptions(query);
      els.routeStatus.textContent = "至少输入 2 个字符搜索地点。";
      return;
    }
    els.routePlaceSearch.disabled = true;
    els.routeStatus.textContent = `正在搜索“${query}”…`;
    const city = (routePickerTarget === "origin" ? routeDestination?.city : routeOrigin?.city) || "";
    try {
      let features = [];
      if (amapConfigured()) {
        try {
          features = await searchAmapFeatures(query, city);
        } catch (error) {
          features = [];
        }
      }
      if (!features.length) {
        routePlaceSearchController = new AbortController();
        const endpoint = location.protocol.startsWith("http") ? new URL("/api/search", location.origin) : new URL(PHOTON_ENDPOINT);
        endpoint.searchParams.set("q", city && !query.includes(city) ? `${query} ${city}` : query);
        endpoint.searchParams.set("limit", "8");
        endpoint.searchParams.set("countrycode", "CN");
        const response = await fetch(endpoint, { signal: routePlaceSearchController.signal, headers: { Accept: "application/geo+json, application/json" } });
        if (!response.ok) throw new Error(`Search failed with ${response.status}`);
        const payload = await response.json();
        features = Array.isArray(payload.features) ? payload.features : [];
      }
      if (requestId !== routePlaceSearchRequestId) return;
      renderRoutePickerOptions(query, features.slice(0, 8));
      els.routeStatus.textContent = features.length ? `找到 ${Math.min(features.length, 8)} 个地点候选。` : "没有找到地点，请补充城市后重试。";
    } catch (error) {
      if (error.name !== "AbortError" && requestId === routePlaceSearchRequestId) {
        renderRoutePickerOptions(query);
        els.routeStatus.textContent = "地点搜索暂时不可用；仍可选择已有岗位或朋友点位。";
      }
    } finally {
      if (requestId === routePlaceSearchRequestId) els.routePlaceSearch.disabled = false;
    }
  }

  function syncRollupButton(button, expanded, subject) {
    if (!button) return;
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", `${expanded ? "收起" : "展开"}${subject}`);
    const label = button.querySelector("span");
    if (label) label.textContent = expanded ? "收起" : "展开";
  }

  function setJobsPanelCollapsed(collapsed, { coordinatePanels = true } = {}) {
    jobsPanelCollapsed = Boolean(collapsed);
    els.missionLeft.classList.toggle("jobs-collapsed", jobsPanelCollapsed);
    els.list.hidden = jobsPanelCollapsed;
    syncRollupButton(els.jobsPanelToggle, !jobsPanelCollapsed, "岗位列表");
    if (!jobsPanelCollapsed && coordinatePanels && !els.routePanel.hidden) {
      setRoutePanelCollapsed(true, { coordinatePanels: false });
    }
  }

  function setRoutePanelCollapsed(collapsed, { coordinatePanels = true } = {}) {
    routePanelCollapsed = Boolean(collapsed);
    els.routePanel.classList.toggle("is-collapsed", routePanelCollapsed);
    els.missionLeft.classList.toggle("route-collapsed", routePanelCollapsed);
    els.routePanelBody.hidden = routePanelCollapsed;
    syncRollupButton(els.routePanelToggle, !routePanelCollapsed, "行程详情");
    if (!routePanelCollapsed && coordinatePanels) {
      setJobsPanelCollapsed(true, { coordinatePanels: false });
    }
  }

  function openRoutePlanner(endpoint) {
    const wasHidden = els.routePanel.hidden;
    routeOrigin = endpoint;
    routeDestination = null;
    routePlans = [];
    selectedRoutePlanIndex = 0;
    setRouteTravelMode("transit");
    selectionCardHidden = true;
    renderSelection();
    clearRouteOnMap();
    els.routeResults.innerHTML = "";
    if (wasHidden) jobsCollapsedBeforeRoute = jobsPanelCollapsed;
    els.routePanel.hidden = false;
    els.missionLeft.classList.add("has-route");
    setJobsPanelCollapsed(true, { coordinatePanels: false });
    setRoutePanelCollapsed(false, { coordinatePanels: false });
    openRoutePicker(endpoint ? "destination" : "origin");
    renderRouteEndpoints();
  }

  function closeRoutePlanner() {
    routePlaceSearchController?.abort();
    clearTimeout(routePlaceSearchTimer);
    routePlaceSearchRequestId += 1;
    routeOrigin = null;
    routeDestination = null;
    routePlans = [];
    els.routePanel.hidden = true;
    els.missionLeft.classList.remove("has-route", "route-collapsed");
    routePanelCollapsed = false;
    els.routePanel.classList.remove("is-collapsed");
    els.routePanelBody.hidden = false;
    syncRollupButton(els.routePanelToggle, true, "行程详情");
    setJobsPanelCollapsed(jobsCollapsedBeforeRoute, { coordinatePanels: false });
    els.routePicker.hidden = true;
    els.routeResults.innerHTML = "";
    clearRouteOnMap();
  }

  function swapRouteEndpoints() {
    [routeOrigin, routeDestination] = [routeDestination, routeOrigin];
    routePlans = [];
    selectedRoutePlanIndex = 0;
    els.routeResults.innerHTML = "";
    clearRouteOnMap();
    renderRouteEndpoints();
  }

  function formatRouteDuration(seconds) {
    const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
    if (minutes < 60) return { value: String(minutes), unit: "分钟" };
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return { value: remainder ? `${hours}小时${remainder}` : `${hours}小时`, unit: "" };
  }

  function routePoint(point) {
    const [lng, lat] = amapPointNumbers(point);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return gcj02ToWgs84(lng, lat);
  }

  function routePath(rawPath) {
    return (Array.isArray(rawPath) ? rawPath : []).map(routePoint).filter(Boolean);
  }

  function routeStop(rawStop) {
    if (!rawStop) return null;
    const name = String(rawStop.name || rawStop.station_name || rawStop.title || "").trim();
    const location = routePoint(rawStop.location || rawStop);
    return name || location ? { name: name || "未命名站点", location } : null;
  }

  function cleanTransitLineName(rawName) {
    return String(rawName || "").split("(")[0].trim();
  }

  function routeMode(segment) {
    const mode = String(segment?.transit_mode || "TRANSIT").toUpperCase();
    return transitModeMeta[mode] ? mode : "TRANSIT";
  }

  function routeLegColor(mode, rideIndex) {
    const palette = (transitModeMeta[mode] || transitModeMeta.TRANSIT).palette;
    return palette[Math.max(0, rideIndex) % palette.length];
  }

  function transitLineNames(lines) {
    const names = [];
    (Array.isArray(lines) ? lines : []).forEach((line) => {
      const name = cleanTransitLineName(line?.name || line?.bus_name || line?.trip);
      if (name && !names.includes(name)) names.push(name);
    });
    return names;
  }

  function normalizeTransitLegs(plan) {
    let rideIndex = 0;
    const legs = (Array.isArray(plan?.segments) ? plan.segments : []).map((segment, segmentIndex) => {
      const mode = routeMode(segment);
      const detail = segment?.transit || {};
      const lines = Array.isArray(detail.lines) ? detail.lines : (Array.isArray(segment?.lines) ? segment.lines : []);
      const primaryLine = lines[0] || {};
      const lineNames = transitLineNames(lines);
      const onStation = routeStop(detail.on_station || segment?.on_station || primaryLine.departure_stop);
      const offStation = routeStop(detail.off_station || segment?.off_station || primaryLine.arrival_stop);
      const rawViaStops = detail.via_stops || segment?.via_stops || primaryLine.via_stops || [];
      const viaStops = (Array.isArray(rawViaStops) ? rawViaStops : []).map(routeStop).filter(Boolean);
      const rawPath = detail.path || segment?.path || primaryLine.path || [];
      const isWalk = mode === "WALK";
      const currentRideIndex = isWalk ? -1 : rideIndex++;
      return {
        id: `segment-${segmentIndex}`,
        index: segmentIndex,
        mode,
        modeLabel: (transitModeMeta[mode] || transitModeMeta.TRANSIT).label,
        className: (transitModeMeta[mode] || transitModeMeta.TRANSIT).className,
        color: routeLegColor(mode, currentRideIndex),
        time: Number(segment?.time || detail.time || primaryLine.time) || 0,
        distance: Number(segment?.distance || detail.distance || primaryLine.distance) || 0,
        instruction: String(segment?.instruction || detail.instruction || "").trim(),
        path: routePath(rawPath),
        lineNames,
        onStation,
        offStation,
        viaStops,
        viaNum: Number(detail.via_num ?? segment?.via_num ?? primaryLine.via_num ?? viaStops.length) || 0,
        entrance: String(detail.entrance?.name || segment?.entrance?.name || "").trim(),
        exit: String(detail.exit?.name || segment?.exit?.name || "").trim(),
        transfer: null,
        fromName: "",
        toName: ""
      };
    });

    const rideLegs = legs.filter((leg) => leg.mode !== "WALK");
    rideLegs.forEach((leg, index) => {
      if (!index) return;
      const previous = rideLegs[index - 1];
      const from = previous.offStation?.name || "上一段下车站";
      const to = leg.onStation?.name || "下一段上车站";
      leg.transfer = {
        from,
        to,
        sameStation: from === to,
        label: from === to ? `在 ${to} 换乘` : `${from} → ${to}`
      };
    });

    legs.forEach((leg, index) => {
      if (leg.mode !== "WALK") return;
      const previousRide = [...legs.slice(0, index)].reverse().find((item) => item.mode !== "WALK");
      const nextRide = legs.slice(index + 1).find((item) => item.mode !== "WALK");
      leg.fromName = previousRide?.offStation?.name || routeOrigin?.label || "起点";
      leg.toName = nextRide?.onStation?.name || routeDestination?.label || "终点";
    });
    return legs;
  }

  function routeLineNames(legs) {
    return legs.filter((leg) => leg.mode !== "WALK").map((leg) => {
      if (!leg.lineNames.length) return leg.modeLabel;
      const label = leg.lineNames.slice(0, 3).join(" / ");
      return leg.lineNames.length > 1 ? `${label}（任选）` : label;
    }).slice(0, 4);
  }

  function normalizeTransitPlan(plan, index) {
    const path = routePath(plan?.path);
    const legs = normalizeTransitLegs(plan);
    const rideLegs = legs.filter((leg) => leg.mode !== "WALK");
    return {
      index,
      time: Number(plan?.time) || 0,
      distance: Number(plan?.distance) || 0,
      walkingDistance: Number(plan?.walking_distance) || 0,
      cost: Number(plan?.cost) || 0,
      transfers: Math.max(0, rideLegs.length - 1),
      lineNames: routeLineNames(legs),
      path,
      legs,
      raw: plan
    };
  }

  function normalizeDrivingLegs(route) {
    const color = routeTravelMeta.driving.color;
    const steps = Array.isArray(route?.steps) ? route.steps : [];
    return steps.map((step, index) => ({
      id: `driving-step-${index}`,
      index,
      mode: "DRIVING",
      modeLabel: "自驾",
      className: "driving",
      color,
      time: Number(step?.time || step?.duration) || 0,
      distance: Number(step?.distance) || 0,
      instruction: String(step?.instruction || "").trim(),
      road: String(step?.road || step?.road_name || "").trim(),
      action: String(step?.action || "").trim(),
      assistantAction: String(step?.assistant_action || "").trim(),
      path: routePath(step?.path),
      lineNames: [],
      onStation: null,
      offStation: null,
      viaStops: [],
      viaNum: 0,
      entrance: "",
      exit: "",
      transfer: null,
      fromName: "",
      toName: ""
    }));
  }

  function drivingRoadNames(legs) {
    return legs.reduce((names, leg) => {
      const road = leg.road && !/^(无名道路|内部道路)$/.test(leg.road) ? leg.road : "";
      if (road && !names.includes(road)) names.push(road);
      return names;
    }, []).slice(0, 4);
  }

  function normalizeDrivingPlan(route, index) {
    const legs = normalizeDrivingLegs(route);
    const directPath = routePath(route?.path);
    return {
      type: "driving",
      index,
      time: Number(route?.time || route?.duration) || 0,
      distance: Number(route?.distance) || 0,
      tolls: Number(route?.tolls || route?.toll) || 0,
      tollDistance: Number(route?.tolls_distance || route?.toll_distance) || 0,
      trafficLights: Number(route?.traffic_lights || route?.trafficLights) || 0,
      restriction: Number(route?.restriction) || 0,
      roadNames: drivingRoadNames(legs),
      path: directPath.length ? directPath : legs.flatMap((leg) => leg.path),
      legs,
      raw: route
    };
  }

  async function queryTransitRoutes() {
    if (!routeOrigin || !routeDestination) return;
    if (routeEndpointKey(routeOrigin) === routeEndpointKey(routeDestination)) {
      els.routeStatus.textContent = "起点和终点不能相同。";
      return;
    }
    els.routeSubmit.disabled = true;
    els.routeResults.innerHTML = "";
    els.routeStatus.textContent = "正在计算公共交通路线…";
    const routeStartedAt = performance.now();
    const usageContext = {
      originCity: routeOrigin.city || "",
      destinationCity: routeDestination.city || ""
    };
    try {
      const AMap = await loadAmapTransfer();
      const [originLng, originLat] = wgs84ToGcj02(routeOrigin.lng, routeOrigin.lat);
      const [destinationLng, destinationLat] = wgs84ToGcj02(routeDestination.lng, routeDestination.lat);
      const service = new AMap.Transfer({
        city: routeOrigin.city || routeDestination.city || "全国",
        cityd: routeDestination.city || routeOrigin.city || "全国",
        policy: AMap.TransferPolicy?.LEAST_TIME ?? 0,
        nightflag: true,
        extensions: "all"
      });
      const result = await new Promise((resolve, reject) => {
        service.search([originLng, originLat], [destinationLng, destinationLat], (status, payload) => {
          if (status === "complete") resolve(payload);
          else if (status === "no_data") reject(new Error("这两个地点之间没有查到公共交通方案。"));
          else reject(new Error(payload?.info || "公共交通路线查询失败。"));
        });
      });
      routePlans = (Array.isArray(result?.plans) ? result.plans : []).slice(0, 3).map(normalizeTransitPlan);
      if (!routePlans.length) throw new Error("这两个地点之间没有查到公共交通方案。");
      selectedRoutePlanIndex = 0;
      renderRouteResults();
      drawSelectedRoute();
      els.routeStatus.textContent = `已找到 ${routePlans.length} 个公共交通方案。`;
      trackApiUsage("route_planning", "success", {
        ...usageContext,
        travelMode: "transit",
        planCount: routePlans.length,
        durationMs: Math.round(performance.now() - routeStartedAt)
      });
    } catch (error) {
      routePlans = [];
      clearRouteOnMap();
      els.routeResults.innerHTML = "";
      els.routeStatus.textContent = error.message || "公共交通路线查询失败，请稍后重试。";
      trackApiUsage("route_planning", "error", {
        ...usageContext,
        travelMode: "transit",
        durationMs: Math.round(performance.now() - routeStartedAt)
      });
    } finally {
      els.routeSubmit.disabled = !(routeOrigin && routeDestination);
    }
  }

  async function queryDrivingRoutes() {
    if (!routeOrigin || !routeDestination) return;
    if (routeEndpointKey(routeOrigin) === routeEndpointKey(routeDestination)) {
      els.routeStatus.textContent = "起点和终点不能相同。";
      return;
    }
    els.routeSubmit.disabled = true;
    els.routeResults.innerHTML = "";
    els.routeStatus.textContent = routeTravelMeta.driving.calculating;
    const routeStartedAt = performance.now();
    const usageContext = {
      originCity: routeOrigin.city || "",
      destinationCity: routeDestination.city || "",
      travelMode: "driving"
    };
    try {
      const AMap = await loadAmapDriving();
      const [originLng, originLat] = wgs84ToGcj02(routeOrigin.lng, routeOrigin.lat);
      const [destinationLng, destinationLat] = wgs84ToGcj02(routeDestination.lng, routeDestination.lat);
      const service = new AMap.Driving({
        policy: AMap.DrivingPolicy?.LEAST_TIME ?? 0,
        ferry: 0,
        extensions: "all"
      });
      const result = await new Promise((resolve, reject) => {
        service.search([originLng, originLat], [destinationLng, destinationLat], (status, payload) => {
          if (status === "complete") resolve(payload);
          else if (status === "no_data") reject(new Error(routeTravelMeta.driving.empty));
          else reject(new Error(payload?.info || "自驾路线查询失败。"));
        });
      });
      routePlans = (Array.isArray(result?.routes) ? result.routes : []).slice(0, 3).map(normalizeDrivingPlan);
      if (!routePlans.length) throw new Error(routeTravelMeta.driving.empty);
      selectedRoutePlanIndex = 0;
      renderRouteResults();
      drawSelectedRoute();
      els.routeStatus.textContent = `已找到 ${routePlans.length} 个自驾方案。`;
      trackApiUsage("route_planning", "success", {
        ...usageContext,
        planCount: routePlans.length,
        durationMs: Math.round(performance.now() - routeStartedAt)
      });
    } catch (error) {
      routePlans = [];
      clearRouteOnMap();
      els.routeResults.innerHTML = "";
      els.routeStatus.textContent = error.message || "自驾路线查询失败，请稍后重试。";
      trackApiUsage("route_planning", "error", {
        ...usageContext,
        durationMs: Math.round(performance.now() - routeStartedAt)
      });
    } finally {
      els.routeSubmit.disabled = !(routeOrigin && routeDestination);
    }
  }

  function queryRoutes() {
    return routeTravelMode === "driving" ? queryDrivingRoutes() : queryTransitRoutes();
  }

  function formatRouteDistance(meters) {
    const value = Math.max(0, Number(meters) || 0);
    return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
  }

  function formatLegDuration(seconds) {
    const duration = formatRouteDuration(seconds);
    return `${duration.value}${duration.unit}`;
  }

  function renderRouteLeg(leg) {
    const colorStyle = `--route-leg-color:${leg.color}`;
    const transfer = leg.transfer ? `
      <li class="route-transfer-row">
        <span>换乘</span>
        <strong>${escapeHtml(leg.transfer.label)}</strong>
      </li>` : "";
    if (leg.mode === "WALK") {
      const walkInstruction = leg.instruction || `从 ${leg.fromName} 步行至 ${leg.toName}`;
      return `${transfer}
        <li class="route-itinerary-step is-walk" style="${colorStyle}">
          <span class="route-step-rail" aria-hidden="true"><i></i><b></b></span>
          <article>
            <header><span class="route-mode-badge">步行</span><small>${escapeHtml(formatLegDuration(leg.time))} · ${escapeHtml(formatRouteDistance(leg.distance))}</small></header>
            <strong>${escapeHtml(leg.fromName)} → ${escapeHtml(leg.toName)}</strong>
            <p>${escapeHtml(walkInstruction)}</p>
          </article>
        </li>`;
    }

    const lineTitle = leg.lineNames.length ? leg.lineNames.slice(0, 3).join(" / ") : (leg.instruction || leg.modeLabel);
    const alternatives = leg.lineNames.length > 1
      ? `<p class="route-line-alternatives">以上 ${leg.lineNames.length} 条线路任选其一</p>`
      : "";
    const onName = leg.onStation?.name || "上车站待确认";
    const offName = leg.offStation?.name || "下车站待确认";
    const viaLabel = leg.viaNum ? `途经 ${leg.viaNum} 站` : "直达";
    const viaDetails = leg.viaStops.length ? `
      <details class="route-via-stops">
        <summary>${escapeHtml(viaLabel)} · 查看站点</summary>
        <p>${leg.viaStops.map((stop) => escapeHtml(stop.name)).join(" · ")}</p>
      </details>` : `<p class="route-via-summary">${escapeHtml(viaLabel)}</p>`;
    return `${transfer}
      <li class="route-itinerary-step is-transit" style="${colorStyle}">
        <span class="route-step-rail" aria-hidden="true"><i></i><b></b></span>
        <article>
          <header><span class="route-mode-badge">${escapeHtml(leg.modeLabel)}</span><small>${escapeHtml(formatLegDuration(leg.time))} · ${escapeHtml(formatRouteDistance(leg.distance))}</small></header>
          <strong class="route-line-title">${escapeHtml(lineTitle)}</strong>
          ${alternatives}
          <div class="route-stations">
            <span><em>上车</em><b>${escapeHtml(onName)}</b>${leg.entrance ? `<small>${escapeHtml(leg.entrance)}</small>` : ""}</span>
            <i aria-hidden="true">→</i>
            <span><em>下车</em><b>${escapeHtml(offName)}</b>${leg.exit ? `<small>${escapeHtml(leg.exit)}</small>` : ""}</span>
          </div>
          ${viaDetails}
        </article>
      </li>`;
  }

  function renderDrivingLeg(leg) {
    const detail = [leg.action, leg.assistantAction].filter(Boolean).join(" · ");
    const title = leg.road || `第 ${leg.index + 1} 段`;
    return `
      <li class="route-itinerary-step is-driving" style="--route-leg-color:${leg.color}">
        <span class="route-step-rail" aria-hidden="true"><i></i><b></b></span>
        <article>
          <header><span class="route-mode-badge">驾车</span><small>${escapeHtml(formatLegDuration(leg.time))} · ${escapeHtml(formatRouteDistance(leg.distance))}</small></header>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(leg.instruction || detail || "沿道路继续行驶")}</p>
          ${detail && detail !== leg.instruction ? `<p class="route-driving-action">${escapeHtml(detail)}</p>` : ""}
        </article>
      </li>`;
  }

  function renderRouteItinerary(plan) {
    if (!plan?.legs?.length) return "";
    const legendItems = [];
    plan.legs.forEach((leg) => {
      const label = leg.mode === "WALK" ? "步行" : (leg.lineNames[0] || leg.modeLabel);
      const key = `${leg.mode}:${label}`;
      if (!legendItems.some((item) => item.key === key)) legendItems.push({ key, label, color: leg.color, walk: leg.mode === "WALK" });
    });
    return `
      <section class="route-itinerary" aria-label="当前方案详细行程">
        <header class="route-itinerary-heading">
          <div><span>DETAILED ITINERARY</span><strong>分段行程</strong></div>
          <div class="route-map-legend" aria-label="路线颜色图例">
            ${legendItems.map((item) => `<span><i class="${item.walk ? "is-walk" : ""}" style="--route-leg-color:${item.color}"></i>${escapeHtml(item.label)}</span>`).join("")}
          </div>
        </header>
        <ol class="route-itinerary-steps">
          ${plan.legs.map(plan.type === "driving" ? renderDrivingLeg : renderRouteLeg).join("")}
        </ol>
      </section>`;
  }

  function renderRouteResults() {
    if (routeTravelMode === "driving") {
      const planTabs = routePlans.map((plan, index) => {
        const duration = formatRouteDuration(plan.time);
        const distance = formatRouteDistance(plan.distance);
        const roadSummary = plan.roadNames.length ? `经 ${plan.roadNames.join(" → ")}` : `推荐路线 ${index + 1}`;
        const extras = [
          plan.tolls ? `预计收费 ¥${Math.round(plan.tolls)}` : "预计无收费",
          plan.tollDistance ? `收费路段 ${formatRouteDistance(plan.tollDistance)}` : "",
          plan.trafficLights ? `${plan.trafficLights} 个红绿灯` : ""
        ].filter(Boolean).join(" · ");
        return `
          <button class="route-plan is-driving" type="button" data-route-plan-index="${index}" aria-pressed="${index === selectedRoutePlanIndex}">
            <span class="route-plan-time"><strong>${escapeHtml(duration.value)}</strong><span>${escapeHtml(duration.unit)}</span></span>
            <span class="route-plan-lines">${escapeHtml(roadSummary)}</span>
            <span class="route-plan-meta">${escapeHtml(distance)} · ${escapeHtml(extras)}</span>
          </button>`;
      }).join("");
      els.routeResults.innerHTML = `<div class="route-plan-tabs" aria-label="自驾路线方案">${planTabs}</div>${renderRouteItinerary(routePlans[selectedRoutePlanIndex])}`;
      return;
    }
    const planTabs = routePlans.map((plan, index) => {
      const duration = formatRouteDuration(plan.time);
      const distance = formatRouteDistance(plan.distance);
      const walk = formatRouteDistance(plan.walkingDistance);
      const lineSummary = plan.lineNames.length ? plan.lineNames.join(" → ") : "公共交通换乘方案";
      return `
        <button class="route-plan" type="button" data-route-plan-index="${index}" aria-pressed="${index === selectedRoutePlanIndex}">
          <span class="route-plan-time"><strong>${escapeHtml(duration.value)}</strong><span>${escapeHtml(duration.unit)}</span></span>
          <span class="route-plan-lines">${escapeHtml(lineSummary)}</span>
          <span class="route-plan-meta">步行 ${escapeHtml(walk)} · 换乘 ${plan.transfers} 次 · ${escapeHtml(distance)}${plan.cost ? ` · ¥${plan.cost}` : ""}</span>
        </button>`;
    }).join("");
    els.routeResults.innerHTML = `<div class="route-plan-tabs" aria-label="公共交通方案">${planTabs}</div>${renderRouteItinerary(routePlans[selectedRoutePlanIndex])}`;
  }

  function ensureRouteMapLayers() {
    if (!mainMapReady || mainMap.getSource("active-transit-route")) return;
    mainMap.addSource("active-transit-route", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
    mainMap.addLayer({
      id: "active-transit-route-halo",
      type: "line",
      source: "active-transit-route",
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "rgba(0, 12, 20, 0.86)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 7, 16, 11],
        "line-opacity": 0.9
      }
    });
    mainMap.addLayer({
      id: "active-transit-route-walk",
      type: "line",
      source: "active-transit-route",
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "mode"], "WALK"]],
      paint: {
        "line-color": "#d2e0e5",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 16, 4.5],
        "line-opacity": 0.88,
        "line-dasharray": [1.2, 1.6]
      }
    });
    mainMap.addLayer({
      id: "active-transit-route-ride",
      type: "line",
      source: "active-transit-route",
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "mode"], "WALK"]],
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#66e2ff"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3.2, 16, 5.8],
        "line-opacity": 0.98
      }
    });
    mainMap.addLayer({
      id: "active-transit-route-points",
      type: "circle",
      source: "active-transit-route",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["case", ["has", "endpoint"], 7, 4.5],
        "circle-color": ["case", ["==", ["get", "endpoint"], "origin"], "#eefbff", ["==", ["get", "endpoint"], "destination"], "#66e2ff", ["coalesce", ["get", "color"], "#d2e0e5"]],
        "circle-stroke-color": "#07151e",
        "circle-stroke-width": ["case", ["has", "endpoint"], 3, 2]
      }
    });
  }

  function clearRouteOnMap() {
    if (!mainMapReady) return;
    const source = mainMap.getSource("active-transit-route");
    source?.setData({ type: "FeatureCollection", features: [] });
  }

  function drawSelectedRoute() {
    if (!mainMapReady || !routeOrigin || !routeDestination) return;
    ensureRouteMapLayers();
    const plan = routePlans[selectedRoutePlanIndex];
    const features = [];
    const boundsCoordinates = [];
    const stationKeys = new Set();
    (plan?.legs || []).forEach((leg) => {
      if (leg.path.length >= 2) {
        features.push({
          type: "Feature",
          properties: { mode: leg.mode, color: leg.color, legIndex: leg.index },
          geometry: { type: "LineString", coordinates: leg.path }
        });
        boundsCoordinates.push(...leg.path);
      }
      if (leg.mode === "WALK") return;
      [
        { stop: leg.onStation, pointType: "board" },
        { stop: leg.offStation, pointType: "alight" }
      ].forEach(({ stop, pointType }) => {
        if (!stop?.location) return;
        const key = stop.location.map((value) => Number(value).toFixed(5)).join(",");
        if (stationKeys.has(key)) return;
        stationKeys.add(key);
        features.push({
          type: "Feature",
          properties: { pointType, label: stop.name, mode: leg.mode, color: leg.color },
          geometry: { type: "Point", coordinates: stop.location }
        });
      });
    });
    if (!features.some((feature) => feature.geometry.type === "LineString") && plan?.path?.length >= 2) {
      features.push({
        type: "Feature",
        properties: { mode: routeTravelMode === "driving" ? "DRIVING" : "TRANSIT", color: routeTravelMeta[routeTravelMode].color },
        geometry: { type: "LineString", coordinates: plan.path }
      });
      boundsCoordinates.push(...plan.path);
    }
    features.push(
      { type: "Feature", properties: { endpoint: "origin" }, geometry: { type: "Point", coordinates: [routeOrigin.lng, routeOrigin.lat] } },
      { type: "Feature", properties: { endpoint: "destination" }, geometry: { type: "Point", coordinates: [routeDestination.lng, routeDestination.lat] } }
    );
    mainMap.getSource("active-transit-route")?.setData({ type: "FeatureCollection", features });
    const bounds = new window.maplibregl.LngLatBounds();
    (boundsCoordinates.length ? boundsCoordinates : [[routeOrigin.lng, routeOrigin.lat], [routeDestination.lng, routeDestination.lat]]).forEach((coordinate) => bounds.extend(coordinate));
    const compact = window.innerWidth < 980;
    mainMap.fitBounds(bounds, {
      padding: compact ? { top: 150, right: 50, bottom: 390, left: 50 } : { top: 130, right: 330, bottom: 300, left: 330 },
      maxZoom: 15.5,
      pitch: 0,
      bearing: 0,
      duration: 1500,
      essential: true
    });
  }

  function renderSelection() {
    const record = selectedVisibleRecord();
    if (!record || selectionCardHidden) {
      els.selectionCard.innerHTML = "";
      delete els.selectionCard.dataset.stage;
      return;
    }
    selectedId = record.id;
    const status = statusMeta[record.stage]?.label || record.stage;
    const schedule = nextIncompleteEvent(record);
    const due = dateState(schedule?.date);
    els.selectionCard.dataset.stage = record.stage;
    els.selectionCard.innerHTML = `
      <div class="selection-main">
        <div class="selection-header">
          <div class="selection-title">${escapeHtml(record.company)} · ${escapeHtml(record.role)}</div>
          <div class="record-status"><i class="status-dot stage-${escapeHtml(record.stage)}"></i>${escapeHtml(status)}${record.stageDetail ? ` · ${escapeHtml(record.stageDetail)}` : ""}</div>
          <button class="selection-close" type="button" data-selection-action="close" aria-label="关闭岗位详情">×</button>
        </div>
        <div class="selection-location"><strong>${escapeHtml(record.building || "办公地点待确认")}</strong><span>${escapeHtml(record.address || `${record.city || "Base"} · 具体地址待确认`)}</span></div>
        <div class="selection-schedule ${due.overdue ? "overdue" : ""}">${schedule ? `${escapeHtml(formatDate(schedule.date))} · ${escapeHtml(schedule.title)}` : "暂无进行中日程"}</div>
      </div>
      <div class="selection-actions">
        ${isMappable(record) ? '<button class="button" type="button" data-selection-action="route">查看行程</button>' : ""}
        <button class="button" type="button" data-selection-action="edit">更新进度</button>
        <button class="button button-quiet" type="button" data-selection-action="delete">删除</button>
      </div>`;
  }

  function clearPointClusterMarkers() {
    pointClusterGroups = new Map();
    mainMap?.getSource("point-clusters")?.setData({ type: "FeatureCollection", features: [] });
  }

  function pointClusterIconId(count, kind) {
    return `point-cluster-${kind}-${Math.min(count, 99)}`;
  }

  function ensurePointClusterIcon(count, kind) {
    const iconId = pointClusterIconId(count, kind);
    if (mainMap.hasImage(iconId)) return iconId;
    const ratio = 2;
    const displaySize = 58;
    const size = displaySize * ratio;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    const center = size / 2;
    const accent = kind === "friend" ? "#ff719d" : kind === "mixed" ? "#9a8dff" : "#62dcff";
    context.scale(ratio, ratio);
    context.shadowColor = accent;
    context.shadowBlur = 10;
    context.fillStyle = "rgba(6, 27, 39, 0.68)";
    context.strokeStyle = accent;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(displaySize / 2, displaySize / 2, 23, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(226, 249, 255, 0.88)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(displaySize / 2, displaySize / 2, 17, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#f4fdff";
    context.font = "700 15px ui-sans-serif, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(count), displaySize / 2, (displaySize / 2) + 0.5);
    mainMap.addImage(iconId, context.getImageData(0, 0, size, size), { pixelRatio: ratio });
    return iconId;
  }

  function ensurePointClusterLayer() {
    if (!mainMapReady || mainMap.getSource("point-clusters")) return;
    mainMap.addSource("point-clusters", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
    mainMap.addLayer({
      id: "point-clusters",
      type: "symbol",
      source: "point-clusters",
      layout: {
        "icon-image": ["get", "iconId"],
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      }
    });
    mainMap.on("click", "point-clusters", (event) => {
      const clusterKey = event.features?.[0]?.properties?.clusterKey;
      const group = clusterKey ? pointClusterGroups.get(clusterKey) : null;
      if (group?.length) zoomToPointCluster(group);
    });
    mainMap.on("mouseenter", "point-clusters", () => { mainMap.getCanvas().style.cursor = "pointer"; });
    mainMap.on("mouseleave", "point-clusters", () => { mainMap.getCanvas().style.cursor = ""; });
  }

  function currentPointMarkerEntries() {
    const entries = [];
    mainMarkers.forEach((marker, id) => {
      const record = records.find((item) => item.id === id);
      const position = marker.getLngLat();
      entries.push({
        id: `job:${id}`,
        kind: "job",
        label: record?.company || "岗位点位",
        lng: position.lng,
        lat: position.lat,
        element: marker.getElement()
      });
    });
    friendMarkers.forEach((marker, id) => {
      const point = friendPoints.find((item) => item.id === id);
      const position = marker.getLngLat();
      entries.push({
        id: `friend:${id}`,
        kind: "friend",
        label: point?.friendName ? `${point.friendName}的点位` : "朋友点位",
        lng: position.lng,
        lat: position.lat,
        element: marker.getElement()
      });
    });
    return entries.sort((left, right) => left.id.localeCompare(right.id));
  }

  function groupNearbyPointMarkers(entries, radius) {
    const parent = entries.map((_, index) => index);
    const find = (index) => {
      let root = index;
      while (parent[root] !== root) root = parent[root];
      while (parent[index] !== index) {
        const next = parent[index];
        parent[index] = root;
        index = next;
      }
      return root;
    };
    const unite = (left, right) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
    };
    const projected = entries.map((entry) => mainMap.project([entry.lng, entry.lat]));
    const radiusSquared = radius * radius;
    for (let left = 0; left < projected.length; left += 1) {
      for (let right = left + 1; right < projected.length; right += 1) {
        const deltaX = projected[left].x - projected[right].x;
        const deltaY = projected[left].y - projected[right].y;
        if ((deltaX * deltaX) + (deltaY * deltaY) <= radiusSquared) unite(left, right);
      }
    }
    const groups = new Map();
    entries.forEach((entry, index) => {
      const root = find(index);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(entry);
    });
    return [...groups.values()];
  }

  function clusterAnchorEntry(group) {
    const projected = group.map((entry) => ({ entry, point: mainMap.project([entry.lng, entry.lat]) }));
    const center = projected.reduce((sum, item) => ({ x: sum.x + item.point.x, y: sum.y + item.point.y }), { x: 0, y: 0 });
    center.x /= projected.length;
    center.y /= projected.length;
    return projected.reduce((closest, item) => {
      const distance = ((item.point.x - center.x) ** 2) + ((item.point.y - center.y) ** 2);
      return distance < closest.distance ? { entry: item.entry, distance } : closest;
    }, { entry: group[0], distance: Number.POSITIVE_INFINITY }).entry;
  }

  function zoomToPointCluster(entries) {
    if (!mainMapReady || !entries.length) return;
    const bounds = new window.maplibregl.LngLatBounds();
    entries.forEach((entry) => bounds.extend([entry.lng, entry.lat]));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compact = window.innerWidth < 980;
    mainMap.fitBounds(bounds, {
      padding: compact ? 72 : { top: 140, right: 340, bottom: 100, left: 400 },
      maxZoom: 13.5,
      pitch: 0,
      bearing: 0,
      duration: reducedMotion ? 0 : 900,
      essential: false
    });
  }

  function updatePointClusters() {
    pointClusterUpdateFrame = null;
    if (!mainMapReady) return;
    ensurePointClusterLayer();
    const entries = currentPointMarkerEntries();
    clearPointClusterMarkers();
    entries.forEach((entry) => { entry.element.hidden = false; });
    if (mainMap.getZoom() >= POINT_CLUSTER_MAX_ZOOM || entries.length < 2) return;

    const groups = groupNearbyPointMarkers(entries, POINT_CLUSTER_RADIUS);
    const features = [];
    groups.filter((group) => group.length > 1).forEach((group) => {
      group.forEach((entry) => { entry.element.hidden = true; });
      const anchorEntry = clusterAnchorEntry(group);
      const kinds = new Set(group.map((entry) => entry.kind));
      const kind = kinds.size > 1 ? "mixed" : group[0].kind;
      const clusterKey = group.map((entry) => entry.id).join("|");
      pointClusterGroups.set(clusterKey, group);
      features.push({
        type: "Feature",
        properties: {
          clusterKey,
          count: group.length,
          kind,
          iconId: ensurePointClusterIcon(group.length, kind)
        },
        geometry: { type: "Point", coordinates: [anchorEntry.lng, anchorEntry.lat] }
      });
    });
    mainMap.getSource("point-clusters")?.setData({ type: "FeatureCollection", features });
  }

  function schedulePointClusterUpdate() {
    if (!mainMapReady || pointClusterUpdateFrame !== null) return;
    pointClusterUpdateFrame = window.requestAnimationFrame(updatePointClusters);
  }

  function renderMapMarkers() {
    const visible = visibleRecords();
    const mapped = visible.filter(isMappable);
    const unknown = visible.length - mapped.length;
    const filteredFriendPoints = visibleFriendPoints();
    els.mapCount.textContent = `${mapped.length} 个已定位 · ${unknown} 个地址待确认${filteredFriendPoints.length ? ` · ${filteredFriendPoints.length} 个朋友点位` : ""}`;
    if (!mainMapReady) return;

    clearPointClusterMarkers();
    mainMarkers.forEach((marker) => marker.remove());
    mainMarkers = new Map();

    mapped.forEach((record) => {
      const markerClass = `job-marker marker-${record.stage}${record.accuracy === "approximate" ? " is-approximate" : ""}${record.id === selectedId ? " is-selected" : ""}`;
      const markerSize = record.locationPreference === "love" ? "22px" : record.locationPreference === "okay" ? "18px" : "15px";
      const label = `${record.company}，${record.role}，${record.building || "地址待确认"}，${statusMeta[record.stage]?.label || record.stage}`;
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = markerClass;
      markerButton.style.setProperty("--marker-size", markerSize);
      markerButton.setAttribute("aria-label", label);
      const markerName = document.createElement("span");
      markerName.className = "globe-marker-name";
      markerName.textContent = record.company;
      markerButton.appendChild(markerName);
      markerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        focusRecord(record.id, true);
      });
      const marker = new window.maplibregl.Marker({ element: markerButton, anchor: "center" })
        .setLngLat([Number(record.lng), Number(record.lat)])
        .addTo(mainMap);
      mainMarkers.set(record.id, marker);
    });
    renderFriendMarkers();
    schedulePointClusterUpdate();
  }

  function renderFriendMarkers() {
    if (!mainMapReady) return;
    clearPointClusterMarkers();
    friendMarkers.forEach((marker) => marker.remove());
    friendMarkers = new Map();
    visibleFriendPoints().forEach((point) => {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = "friend-marker";
      markerButton.style.setProperty("--friend-color", point.friendColor || friendColorForCode(point.shareCode));
      markerButton.setAttribute("aria-label", `${point.friendName}的校招点位${point.city ? `，${point.city}` : ""}`);
      const markerName = document.createElement("span");
      markerName.className = "globe-marker-name";
      markerName.textContent = point.friendName;
      markerButton.append(markerName);
      markerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openRoutePlanner(endpointFromFriend(point));
      });
      const marker = new window.maplibregl.Marker({ element: markerButton, anchor: "center" })
        .setLngLat([point.lng, point.lat])
        .addTo(mainMap);
      friendMarkers.set(point.id, marker);
    });
    schedulePointClusterUpdate();
  }

  function render() {
    refreshCityFilter();
    refreshFriendFilter();
    const visible = visibleRecords();
    if (visible.length && !visible.some((record) => record.id === selectedId)) selectedId = visible[0].id;
    renderWorkspaceOverview();
    renderInsights();
    renderList();
    renderSelection();
    renderMapMarkers();
  }

  function updateMapMode() {
    if (!mainMapReady) return;
    const zoom = mainMap.getZoom();
    const mapFrame = document.querySelector(".globe-frame");
    let label = "平面地图";
    let code = "CHINA";
    if (zoom >= 8.6) {
      label = "清晰街道";
      code = "STREET";
    } else if (zoom >= 5) {
      label = "城市区域";
      code = "CITY";
    }
    els.mapModeLabel.textContent = label;
    els.mapZoomLabel.textContent = `${code} · Z${zoom.toFixed(1)}`;
    mapFrame?.classList.toggle("is-approach", zoom >= 5 && zoom < 8.6);
    mapFrame?.classList.toggle("is-street", zoom >= 8.6);
  }

  function showMapOverview(animated = true) {
    if (!mainMapReady) return;
    const view = { ...RESEARCH_DEFAULT_VIEW };
    if (animated) {
      mainMap.flyTo({ ...view, duration: 900, essential: true });
    } else {
      mainMap.jumpTo(view);
    }
  }

  function focusChinaView(animated = true) {
    if (!mainMapReady) {
      chinaFocusPending = true;
      return;
    }
    chinaFocusPending = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const view = { ...RESEARCH_DEFAULT_VIEW };
    if (animated && !reducedMotion) {
      mainMap.flyTo({ ...view, duration: 2200, curve: 1.25, speed: 0.72, essential: false });
    } else {
      mainMap.jumpTo(view);
    }
  }

  function initOverviewMap() {
    if (!byId("overview-map")) return;
    overviewMapReady = true;
    renderOverviewMapMarkers();
  }

  function initMainMap() {
    if (!window.maplibregl) {
      els.mapLoading.textContent = "平面地图组件加载失败；岗位与地址记录仍可使用。";
      els.mapCount.textContent = "地图暂不可用";
      return;
    }
    mainMap = new window.maplibregl.Map({
      container: "job-map",
      style: RESEARCH_MAP_STYLE,
      center: RESEARCH_DEFAULT_VIEW.center,
      zoom: RESEARCH_DEFAULT_VIEW.zoom,
      minZoom: 2,
      maxZoom: 19,
      maxPitch: 0,
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      touchPitch: false,
      attributionControl: true,
      renderWorldCopies: false,
      antialias: true
    });
    mainMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mainMap.on("load", () => {
      mainMapReady = true;
      els.mapLoading.hidden = true;
      ensurePointClusterLayer();
      ensureRouteMapLayers();
      renderMapMarkers();
      showMapOverview(false);
      updateMapMode();
      if (chinaFocusPending) window.requestAnimationFrame(() => focusChinaView(true));
    });
    mainMap.on("zoom", updateMapMode);
    mainMap.on("zoomend", schedulePointClusterUpdate);
    mainMap.on("moveend", schedulePointClusterUpdate);
    mainMap.on("pitch", updateMapMode);
  }

  function fitVisibleRecords(animated = true) {
    if (!mainMapReady) return;
    const mapped = visibleRecords().filter(isMappable);
    if (!mapped.length) {
      showMapOverview(animated);
      return;
    }
    if (mapped.length === 1) {
      const view = {
        center: [Number(mapped[0].lng), Number(mapped[0].lat)],
        zoom: 13.2,
        pitch: 0,
        bearing: 0
      };
      if (animated) mainMap.flyTo({ ...view, duration: 1900, essential: true });
      else mainMap.jumpTo(view);
      return;
    }
    const bounds = new window.maplibregl.LngLatBounds();
    mapped.forEach((record) => bounds.extend([Number(record.lng), Number(record.lat)]));
    mainMap.fitBounds(bounds, {
      padding: 100,
      maxZoom: 7.8,
      pitch: 0,
      bearing: 0,
      duration: animated ? 1700 : 0,
      essential: true
    });
  }

  function focusRecord(recordId, flyToMap) {
    if (!els.routePanel.hidden) closeRoutePlanner();
    selectedId = recordId;
    selectionCardHidden = false;
    render();
    const record = records.find((item) => item.id === recordId);
    if (flyToMap && mainMapReady && record && isMappable(record)) {
      mainMap.flyTo({
        center: [Number(record.lng), Number(record.lat)],
        zoom: 15.2,
        pitch: 0,
        bearing: 0,
        duration: 2200,
        essential: true
      });
    }
  }

  function amapPointNumbers(point) {
    if (!point) return [null, null];
    if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];
    const lng = Number(typeof point.getLng === "function" ? point.getLng() : point.lng);
    const lat = Number(typeof point.getLat === "function" ? point.getLat() : point.lat);
    return [lng, lat];
  }

  function pickerCenterWgs84() {
    if (!pickerMapReady || !pickerMap) return null;
    if (pickerProvider === "amap") {
      const [lng, lat] = amapPointNumbers(pickerMap.getCenter());
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      const [wgsLng, wgsLat] = gcj02ToWgs84(lng, lat);
      return { lng: wgsLng, lat: wgsLat };
    }
    const center = pickerMap.getCenter();
    return { lng: Number(center.lng), lat: Number(center.lat) };
  }

  function pickerZoom() {
    return pickerMapReady && pickerMap ? Number(pickerMap.getZoom()) || 10 : 10;
  }

  function resizePickerMap() {
    if (!pickerMap) return;
    if (pickerProvider === "amap") pickerMap.resize?.();
    else pickerMap.invalidateSize?.();
  }

  async function ensurePickerMap() {
    if (pickerMap) return pickerMap;
    if (pickerMapPromise) return pickerMapPromise;
    pickerMapPromise = (async () => {
      if (amapConfigured()) {
        try {
          const AMap = await loadAmap();
          pickerProvider = "amap";
          pickerMap = new AMap.Map("picker-map", {
            center: [116.4074, 39.9042],
            zoom: 10,
            viewMode: "2D",
            mapStyle: "amap://styles/fresh"
          });
          pickerMapReady = true;
          els.pickerMapPlaceholder.hidden = true;
          els.placeProviderChip.textContent = "高德 POI";
          pickerMap.on("click", (event) => {
            const [providerLng, providerLat] = amapPointNumbers(event.lnglat);
            const [lng, lat] = gcj02ToWgs84(providerLng, providerLat);
            draftPlaceMeta = {
              provider: "manual",
              providerPlaceId: "",
              coordinateSystem: "WGS84",
              providerCoordinateSystem: "GCJ02",
              providerLng,
              providerLat
            };
            selectedPlaceIndex = -1;
            setPickerPoint(lng, lat, { fly: false, source: "manual", coordinateSystem: "WGS84" });
            els.accuracy.value = "approximate";
            els.placeSearchStatus.textContent = "已手动放置 Pin；精确度已设为大致区域，可继续拖动微调。";
            renderSearchResults();
          });
          return pickerMap;
        } catch (error) {
          amapLoadPromise = null;
          els.placeSearchStatus.textContent = "高德地图加载失败，已切换到开放地图；搜索仍会自动尝试高德 POI。";
        }
      }

      if (!window.L) return null;
      pickerProvider = "leaflet";
      els.placeProviderChip.textContent = "开放地图";
      pickerMap = L.map("picker-map", {
        center: [39.9042, 116.4074],
        zoom: 10,
        minZoom: 2,
        maxZoom: 19,
        zoomControl: false
      });
      L.control.zoom({ position: "topright" }).addTo(pickerMap);
      L.tileLayer(MAP_TILES.street.url, MAP_TILES.street.options).addTo(pickerMap);
      pickerMapReady = true;
      els.pickerMapPlaceholder.hidden = true;
      pickerMap.on("click", (event) => {
        draftPlaceMeta = {
          provider: "manual",
          providerPlaceId: "",
          coordinateSystem: "WGS84",
          providerCoordinateSystem: "WGS84",
          providerLng: event.latlng.lng,
          providerLat: event.latlng.lat
        };
        selectedPlaceIndex = -1;
        setPickerPoint(event.latlng.lng, event.latlng.lat, { fly: false, source: "manual", coordinateSystem: "WGS84" });
        els.accuracy.value = "approximate";
        els.placeSearchStatus.textContent = "已手动放置 Pin；精确度已设为大致区域，可继续拖动微调。";
        renderSearchResults();
      });
      return pickerMap;
    })();
    try {
      return await pickerMapPromise;
    } finally {
      pickerMapPromise = null;
    }
  }

  function ensurePickerMarker() {
    if (pickerMarker || !pickerMap) return;
    if (pickerProvider === "amap") {
      pickerMarker = new window.AMap.Marker({
        position: [116.4074, 39.9042],
        draggable: true,
        anchor: "bottom-center"
      });
      pickerMarker.on("dragend", () => {
        const [providerLng, providerLat] = amapPointNumbers(pickerMarker.getPosition());
        const [lng, lat] = gcj02ToWgs84(providerLng, providerLat);
        draftPlaceMeta = {
          provider: "manual-adjusted",
          providerPlaceId: draftPlaceMeta?.providerPlaceId || "",
          coordinateSystem: "WGS84",
          providerCoordinateSystem: "GCJ02",
          providerLng,
          providerLat
        };
        selectedPlaceIndex = -1;
        setCoordinateFields(lng, lat);
        els.accuracy.value = "approximate";
        els.placeSearchStatus.textContent = "Pin 已校正；精确度已改为大致区域。";
        renderSearchResults();
      });
      return;
    }

    const icon = L.divIcon({
      className: "picker-pin-shell",
      html: '<div class="picker-pin" aria-hidden="true"></div>',
      iconSize: [44, 52],
      iconAnchor: [22, 47]
    });
    pickerMarker = L.marker([39.9042, 116.4074], { draggable: true, icon, keyboard: false });
    pickerMarker.on("dragend", () => {
      const point = pickerMarker.getLatLng();
      draftPlaceMeta = {
        provider: "manual-adjusted",
        providerPlaceId: draftPlaceMeta?.providerPlaceId || "",
        coordinateSystem: "WGS84",
        providerCoordinateSystem: "WGS84",
        providerLng: point.lng,
        providerLat: point.lat
      };
      selectedPlaceIndex = -1;
      setCoordinateFields(point.lng, point.lat);
      els.accuracy.value = "approximate";
      els.placeSearchStatus.textContent = "Pin 已校正；精确度已改为大致区域。";
      renderSearchResults();
    });
  }

  function setCoordinateFields(lng, lat) {
    els.lng.value = Number(lng).toFixed(6);
    els.lat.value = Number(lat).toFixed(6);
  }

  function setPickerPoint(lng, lat, options = {}) {
    const longitude = parseCoordinate(lng, -180, 180);
    const latitude = parseCoordinate(lat, -90, 90);
    if (longitude === null || latitude === null) return;
    const inputIsGcj02 = options.coordinateSystem === "GCJ02";
    const [wgsLng, wgsLat] = inputIsGcj02 ? gcj02ToWgs84(longitude, latitude) : [longitude, latitude];
    const [providerLng, providerLat] = inputIsGcj02 ? [longitude, latitude] : wgs84ToGcj02(longitude, latitude);
    setCoordinateFields(wgsLng, wgsLat);
    if (!pickerMap) return;
    ensurePickerMarker();
    if (pickerProvider === "amap") {
      pickerMarker.setPosition([providerLng, providerLat]);
      pickerMarker.setMap(pickerMap);
      if (options.fly !== false) pickerMap.setZoomAndCenter(options.source === "existing" ? 16 : 17, [providerLng, providerLat]);
    } else {
      pickerMarker.setLatLng([wgsLat, wgsLng]);
      if (!pickerMap.hasLayer(pickerMarker)) pickerMarker.addTo(pickerMap);
      if (options.fly !== false) {
        pickerMap.flyTo([wgsLat, wgsLng], options.source === "existing" ? 16 : 17, { duration: 0.7 });
      }
    }
  }

  function formatPlaceCity(properties) {
    return properties.city || properties.locality || properties.state || "";
  }

  function uniqueParts(values) {
    return values.filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);
  }

  function formatPlaceAddress(properties) {
    if (properties.formattedAddress) return properties.formattedAddress;
    const street = [properties.street, properties.housenumber].filter(Boolean).join("");
    return uniqueParts([
      properties.state,
      properties.city || properties.locality,
      properties.district || properties.county,
      street,
      properties.postcode
    ]).join(" · ");
  }

  function placeName(feature) {
    const properties = feature.properties || {};
    return properties.name || properties.street || properties.city || "未命名地点";
  }

  function placeKey(feature) {
    const properties = feature.properties || {};
    if (properties.amapId) return `AMAP:${properties.amapId}`;
    return `${properties.osm_type || "P"}${properties.osm_id || feature.geometry?.coordinates?.join(",")}`;
  }

  function isExactBuilding(feature) {
    const properties = feature.properties || {};
    if (properties.provider === "amap") return true;
    return ["building", "office", "shop", "amenity", "tourism"].includes(properties.osm_key)
      || ["commercial", "office", "company"].includes(properties.osm_value);
  }

  function amapPoiToFeature(poi) {
    const [lng, lat] = amapPointNumbers(poi.location);
    const values = [poi.pname, poi.cityname, poi.adname, typeof poi.address === "string" ? poi.address : ""]
      .filter((value) => typeof value === "string" && value.trim());
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        provider: "amap",
        amapId: poi.id || "",
        name: poi.name || "未命名地点",
        formattedAddress: uniqueParts(values).join(""),
        state: typeof poi.pname === "string" ? poi.pname : "",
        city: typeof poi.cityname === "string" ? poi.cityname : (typeof poi.pname === "string" ? poi.pname : ""),
        district: typeof poi.adname === "string" ? poi.adname : "",
        type: typeof poi.type === "string" ? poi.type : ""
      }
    };
  }

  async function searchAmapFeatures(query, city) {
    const searchStartedAt = performance.now();
    try {
      const AMap = await loadAmapPlaceSearch();
      const features = await new Promise((resolve, reject) => {
        const service = new AMap.PlaceSearch({
          city: city || "全国",
          citylimit: Boolean(city),
          pageSize: 8,
          pageIndex: 1,
          extensions: "all"
        });
        service.search(query, (status, result) => {
          if (status === "complete") {
            const pois = Array.isArray(result?.poiList?.pois) ? result.poiList.pois : [];
            resolve(pois.map(amapPoiToFeature).filter((feature) => feature.geometry.coordinates.every(Number.isFinite)));
            return;
          }
          if (status === "no_data") {
            resolve([]);
            return;
          }
          reject(new Error(result?.info || "AMap place search failed"));
        });
      });
      trackApiUsage("place_search", "success", {
        city: city || "全国",
        resultCount: features.length,
        durationMs: Math.round(performance.now() - searchStartedAt)
      });
      return features;
    } catch (error) {
      trackApiUsage("place_search", "error", {
        city: city || "全国",
        durationMs: Math.round(performance.now() - searchStartedAt)
      });
      throw error;
    }
  }

  function renderSearchResults() {
    if (!searchResults.length) {
      const message = els.placeQuery.value.trim().length >= 2 ? "没有候选结果；可尝试补充城市，或直接在地图上点选。" : "搜索后会显示多个候选地址";
      els.placeResults.innerHTML = `<p class="empty-note">${escapeHtml(message)}</p>`;
      return;
    }
    els.placeResults.innerHTML = searchResults.map((feature, index) => {
      const address = formatPlaceAddress(feature.properties || {}) || "地址信息不完整";
      return `
        <button class="place-result" type="button" role="option" data-place-index="${index}" aria-selected="${index === selectedPlaceIndex}">
          <span class="place-result-name">${escapeHtml(placeName(feature))}</span>
          <span class="place-result-address">${escapeHtml(address)}</span>
        </button>`;
    }).join("");
  }

  function applySearchResults(features, query, fromCache = false) {
    const seen = new Set();
    searchResults = features
      .filter((feature) => feature?.geometry?.type === "Point" && Array.isArray(feature.geometry.coordinates))
      .filter((feature) => {
        const key = placeKey(feature);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
    selectedPlaceIndex = -1;
    renderSearchResults();
    const providerLabel = searchResults[0]?.properties?.provider === "amap" ? "高德 POI" : "OpenStreetMap";
    els.placeSearchStatus.textContent = searchResults.length
      ? `${searchResults.length} 个候选 · ${providerLabel} 搜索${fromCache ? " · 已缓存" : ""}`
      : `没有找到“${query}”；建议输入“公司或地点名 + 城市”。`;
  }

  async function searchPlaces(rawQuery) {
    const requestId = ++searchRequestId;
    searchController?.abort();
    const query = rawQuery.trim();
    if (query.length < 2) {
      searchResults = [];
      renderSearchResults();
      els.placeSearchStatus.textContent = "至少输入 2 个字符。";
      els.placeSearchButton.disabled = false;
      return;
    }

    const city = els.city.value.trim();
    const fullQuery = city && !query.includes(city) ? `${query} ${city}` : query;
    const center = pickerCenterWgs84();
    const biasKey = center ? `${center.lat.toFixed(2)},${center.lng.toFixed(2)}` : "none";
    const cacheKey = `${amapConfigured() ? "amap" : "photon"}|${fullQuery.toLocaleLowerCase("zh-CN")}|${biasKey}`;
    if (searchCache.has(cacheKey)) {
      if (requestId === searchRequestId) applySearchResults(searchCache.get(cacheKey), query, true);
      els.placeSearchButton.disabled = false;
      return;
    }

    searchController = new AbortController();
    els.placeSearchButton.disabled = true;
    els.placeSearchStatus.textContent = `正在搜索“${fullQuery}”…`;

    try {
      if (amapConfigured()) {
        try {
          const features = await searchAmapFeatures(query, city);
          if (features.length) {
            searchCache.set(cacheKey, features);
            if (requestId === searchRequestId) applySearchResults(features, query);
            return;
          }
        } catch (error) {
          // Continue with the public fallback if the AMap service is unavailable.
        }
      }
      const endpoints = location.protocol.startsWith("http")
        ? [new URL("/api/search", location.origin).href, PHOTON_ENDPOINT]
        : [PHOTON_ENDPOINT];
      let data = null;
      let lastError = null;
      for (const endpoint of endpoints) {
        const url = new URL(endpoint);
        url.searchParams.set("q", fullQuery);
        url.searchParams.set("limit", "8");
        url.searchParams.set("countrycode", "CN");
        if (center) {
          url.searchParams.set("lon", center.lng.toFixed(5));
          url.searchParams.set("lat", center.lat.toFixed(5));
          url.searchParams.set("zoom", String(Math.round(pickerZoom())));
          url.searchParams.set("location_bias_scale", "0.2");
        }
        try {
          const response = await fetch(url, {
            signal: searchController.signal,
            headers: { Accept: "application/geo+json, application/json" }
          });
          if (!response.ok) throw new Error(`Search failed with ${response.status}`);
          data = await response.json();
          break;
        } catch (error) {
          if (error.name === "AbortError") throw error;
          lastError = error;
        }
      }
      if (!data) throw lastError || new Error("Search unavailable");
      const features = Array.isArray(data.features) ? data.features : [];
      searchCache.set(cacheKey, features);
      if (requestId === searchRequestId) applySearchResults(features, query);
    } catch (error) {
      if (error.name !== "AbortError" && requestId === searchRequestId) {
        searchResults = [];
        renderSearchResults();
        els.placeSearchStatus.textContent = "地点搜索暂时不可用；仍可在地图上点选或手填坐标。";
      }
    } finally {
      if (requestId === searchRequestId) els.placeSearchButton.disabled = false;
    }
  }

  function selectSearchResult(index) {
    const feature = searchResults[index];
    if (!feature) return;
    const [lng, lat] = feature.geometry.coordinates.map(Number);
    const properties = feature.properties || {};
    selectedPlaceIndex = index;
    const isAmap = properties.provider === "amap";
    draftPlaceMeta = isAmap
      ? {
          provider: "高德地图",
          providerPlaceId: placeKey(feature),
          coordinateSystem: "WGS84",
          providerCoordinateSystem: "GCJ02",
          providerLng: lng,
          providerLat: lat
        }
      : {
          provider: "Photon / OpenStreetMap",
          providerPlaceId: placeKey(feature),
          coordinateSystem: "WGS84",
          providerCoordinateSystem: "WGS84",
          providerLng: lng,
          providerLat: lat
        };
    els.building.value = placeName(feature);
    els.address.value = formatPlaceAddress(properties) || properties.name || "";
    const city = formatPlaceCity(properties);
    if (city) els.city.value = city;
    els.accuracy.value = isExactBuilding(feature) ? "confirmed" : "approximate";
    setPickerPoint(lng, lat, { fly: true, source: "search", coordinateSystem: isAmap ? "GCJ02" : "WGS84" });
    renderSearchResults();
    els.placeSearchStatus.textContent = `已选择：${placeName(feature)} · 可拖动 Pin 继续校正`;
  }

  function clearPickerMarker() {
    if (pickerMarker) {
      if (pickerProvider === "amap") pickerMarker.setMap(null);
      else pickerMarker.remove();
      pickerMarker = null;
    }
  }

  function compactJobValue(value) {
    return String(value || "").toLocaleLowerCase("zh-CN").replace(/[\s·•—–_\-\/|｜（）()【】\[\],，.。]/g, "");
  }

  function canonicalJobUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      url.hash = "";
      [...url.searchParams.keys()].forEach((key) => {
        if (/^(utm_|spm|from|source|sourceid|campaign|tracking|track)/i.test(key)) url.searchParams.delete(key);
      });
      url.hostname = url.hostname.toLowerCase();
      url.pathname = url.pathname.replace(/\/+$/, "") || "/";
      return url.href;
    } catch (error) {
      return raw.replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
    }
  }

  function findJobDuplicates({ company = "", role = "", city = "", url = "" } = {}) {
    const targetUrl = canonicalJobUrl(url);
    const targetCompany = compactJobValue(company);
    const targetRole = compactJobValue(role);
    const targetCity = compactJobValue(city);
    return records
      .filter((record) => record.id !== editingId && !record.isDemo)
      .map((record) => {
        const sameUrl = targetUrl && targetUrl === canonicalJobUrl(record.jdUrl || record.jdSnapshot?.sourceUrl);
        const sameIdentity = targetCompany && targetRole && targetCity
          && targetCompany === compactJobValue(record.company)
          && targetRole === compactJobValue(record.role)
          && targetCity === compactJobValue(record.city);
        if (!sameUrl && !sameIdentity) return null;
        return { record, reason: sameUrl ? "招聘链接相同" : "公司、岗位和 Base 相同" };
      })
      .filter(Boolean);
  }

  function suggestRoleDirection(role, snapshotText = "") {
    if (!plannedRoleDirections.length) return null;
    const roleSource = compactJobValue(role);
    const textSource = String(snapshotText || "").toLocaleLowerCase("zh-CN").slice(0, 24_000);
    const ranked = plannedRoleDirections.map((direction, index) => {
      const directionSource = compactJobValue(direction);
      let score = 0;
      if (directionSource && roleSource.includes(directionSource)) score += 14;
      else if (directionSource && textSource.includes(directionSource)) score += 5;
      directionSemanticGroups.forEach((group) => {
        if (!group.direction.test(direction)) return;
        group.terms.forEach((term) => {
          const normalizedTerm = compactJobValue(term);
          if (!normalizedTerm) return;
          if (roleSource.includes(normalizedTerm)) score += 7;
          else if (textSource.includes(normalizedTerm)) score += 1.5;
        });
      });
      return { value: direction, score, index };
    }).sort((left, right) => right.score - left.score || left.index - right.index);
    const best = ranked[0];
    if (!best || best.score < 4) return null;
    return {
      value: best.value,
      confidence: best.score >= 12 ? "high" : "medium",
      source: "direction-match"
    };
  }

  function setJobImportState(label, state = "", message = "") {
    els.jobImportState.textContent = label;
    if (state) els.jobImportState.dataset.state = state;
    else delete els.jobImportState.dataset.state;
    if (message) els.jobImportStatus.textContent = message;
    if (state === "error") els.jobImportStatus.dataset.state = "error";
    else delete els.jobImportStatus.dataset.state;
  }

  function jobImportField(rawField) {
    const source = rawField && typeof rawField === "object" ? rawField : { value: rawField };
    return {
      value: String(source?.value || "").trim(),
      confidence: ["high", "medium", "low"].includes(source?.confidence) ? source.confidence : "low",
      source: String(source?.source || "unknown")
    };
  }

  function renderJobImportReview() {
    const fields = draftJobImportResult?.fields;
    if (!fields) {
      els.jobImportReview.hidden = true;
      els.jobImportReview.innerHTML = "";
      return;
    }
    const items = [
      ["公司", jobImportField(fields.company)],
      ["岗位", jobImportField(fields.role)],
      ["Base", jobImportField(fields.city)],
      ["方向", jobImportField(fields.direction)],
      ["截止", jobImportField(fields.deadline)]
    ];
    els.jobImportReview.innerHTML = items.map(([label, value]) => {
      const displayValue = value.value || "未识别";
      return `<span class="job-import-field" data-confidence="${escapeHtml(value.confidence)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(displayValue)}</strong></span>`;
    }).join("");
    els.jobImportReview.hidden = false;
  }

  function refreshJobImportDuplicates() {
    draftDuplicateRecords = findJobDuplicates({
      company: els.company.value,
      role: els.role.value,
      city: els.city.value,
      url: els.jdUrl.value
    });
    if (!draftDuplicateRecords.length) {
      els.jobImportDuplicate.hidden = true;
      els.jobImportDuplicate.innerHTML = "";
      return;
    }
    const first = draftDuplicateRecords[0];
    const extra = draftDuplicateRecords.length > 1 ? `，另有 ${draftDuplicateRecords.length - 1} 条相似记录` : "";
    els.jobImportDuplicate.innerHTML = `<strong>可能重复：</strong>${escapeHtml(first.record.company)} · ${escapeHtml(first.record.role)} · ${escapeHtml(first.record.city)}（${escapeHtml(first.reason)}${extra}）。仍可检查后保存。`;
    els.jobImportDuplicate.hidden = false;
  }

  function upsertImportedDeadline(deadline) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || "")) return;
    const existingIndex = draftJobEvents.findIndex((event) => event.type === "application" && event.source === "jd-import");
    const existing = existingIndex >= 0 ? draftJobEvents[existingIndex] : null;
    const importedEvent = normalizeEvent({
      ...(existing || {}),
      id: existing?.id || makeEventId(),
      type: "application",
      title: existing?.title || "投递截止",
      date: deadline,
      source: "jd-import",
      createdAt: existing?.createdAt || today()
    });
    if (existingIndex >= 0) draftJobEvents.splice(existingIndex, 1, importedEvent);
    else draftJobEvents.unshift(importedEvent);
    renderJobScheduleList();
  }

  async function jobImportErrorMessage(error) {
    try {
      if (error?.context instanceof Response) {
        const payload = await error.context.clone().json();
        if (payload?.error) return String(payload.error);
      }
    } catch (contextError) {
      // Fall back to the SDK message below.
    }
    return String(error?.message || "招聘信息识别失败，请改为粘贴 JD 文本。");
  }

  function applyJobImportResult(result) {
    const fields = result?.fields || {};
    const company = jobImportField(fields.company);
    const role = jobImportField(fields.role);
    const city = jobImportField(fields.city);
    const deadline = jobImportField(fields.deadline);
    const officeQuery = jobImportField(fields.officeQuery);
    const importedDirection = jobImportField(fields.direction);
    const exactImportedDirection = importedDirection.value && plannedRoleDirections.includes(importedDirection.value)
      ? importedDirection
      : null;
    const directionContext = [importedDirection.value, result?.snapshot?.text || ""].filter(Boolean).join("\n");
    const direction = exactImportedDirection || suggestRoleDirection(role.value, directionContext) || jobImportField("");

    if (company.value) els.company.value = company.value;
    if (role.value) els.role.value = role.value;
    if (city.value) els.city.value = city.value;
    if (direction.value && plannedRoleDirections.includes(direction.value)) {
      els.roleDirection.value = direction.value;
      syncSystemSelect(els.roleDirection, true);
    }
    if (!editingId) {
      els.stage.value = "screening";
      syncSystemSelect(els.stage, true);
    }
    if (result?.sourceUrl) els.jdUrl.value = result.sourceUrl;

    const normalizedFields = { company, role, city, deadline, officeQuery, direction };
    draftJobImportResult = { fields: normalizedFields };
    draftJobSnapshot = normalizeJdSnapshot({
      version: 1,
      sourceUrl: result?.sourceUrl || els.jdUrl.value,
      mode: result?.mode || (els.jdSourceText.value.trim() ? "text" : "url"),
      capturedAt: result?.capturedAt || new Date().toISOString(),
      contentHash: result?.contentHash || result?.snapshot?.contentHash || "",
      pageTitle: result?.snapshot?.pageTitle || "",
      text: result?.snapshot?.text || els.jdSourceText.value,
      fields: normalizedFields
    });

    if (deadline.value) upsertImportedDeadline(deadline.value);
    renderJobImportReview();
    refreshJobImportDuplicates();

    const recognizedCount = [company, role, city, direction, deadline].filter((item) => item.value).length;
    const sourceLabel = result?.mode === "text" ? "粘贴文本" : "招聘页面";
    setJobImportState("已预填", "success", `已从${sourceLabel}识别 ${recognizedCount} 项；请核对下方表单${deadline.value ? "，投递截止已加入岗位日程" : ""}。`);

    const locationQuery = officeQuery.value || company.value;
    if (locationQuery && city.value) {
      els.placeQuery.value = `${locationQuery} ${city.value}`.trim();
      els.placeSearchStatus.textContent = "正在查找该城市的办公地点候选…";
      searchPlaces(els.placeQuery.value);
    } else if (city.value) {
      els.placeSearchStatus.textContent = "已识别 Base 城市；具体办公地点尚未确认。";
    }
  }

  async function handleJobImport() {
    const url = els.jdUrl.value.trim();
    const text = els.jdSourceText.value.trim();
    if (!url && text.length < 20) {
      els.jobImportPaste.open = true;
      setJobImportState("需要内容", "error", "请粘贴招聘链接，或输入至少 20 个字符的 JD 文本。");
      (url ? els.jdUrl : els.jdSourceText).focus();
      return;
    }
    if (!supabaseClient || !authUser) {
      setJobImportState("需要登录", "error", "登录云端账户后才能安全读取招聘页面。");
      return;
    }
    els.jobImportSubmit.disabled = true;
    els.jobImportSubmit.dataset.loading = "true";
    els.jobImportSubmit.textContent = "正在识别…";
    setJobImportState("正在识别", "loading", text ? "正在分析粘贴的 JD 文本…" : "正在读取公开招聘页面；通常需要几秒钟。需要登录的页面可能无法直接读取。");
    try {
      const { data, error } = await supabaseClient.functions.invoke("job-import", {
        body: { url, text }
      });
      if (error) throw error;
      if (!data || data.error) throw new Error(data?.error || "没有收到可用的识别结果。");
      applyJobImportResult(data);
    } catch (error) {
      setJobImportState("识别失败", "error", await jobImportErrorMessage(error));
      if (!text) els.jobImportPaste.open = true;
    } finally {
      els.jobImportSubmit.disabled = false;
      delete els.jobImportSubmit.dataset.loading;
      els.jobImportSubmit.textContent = "识别并预填";
    }
  }

  function populateForm(record) {
    const values = record || {
      company: "",
      role: "",
      roleDirection: "",
      stage: "pending",
      stageDetail: "",
      city: "",
      building: "",
      address: "",
      accuracy: "unknown",
      locationPreference: "okay",
      lng: "",
      lat: "",
      priority: "medium",
      jdUrl: "",
      notes: ""
    };
    Object.entries(values).forEach(([name, value]) => {
      const control = els.form.elements.namedItem(name);
      if (control && (typeof value === "string" || typeof value === "number")) control.value = value ?? "";
    });
    [els.roleDirection, els.stage, els.priority, els.locationPreference].forEach((select) => syncSystemSelect(select));
    els.placeQuery.value = record ? `${record.building} ${record.city}`.trim() : "";
  }

  function renderJobRoleDirectionOptions(record = null) {
    if (!els.roleDirection) return;
    const savedDirection = String(record?.roleDirection || "").trim();
    const options = [...plannedRoleDirections];
    if (savedDirection && !options.includes(savedDirection)) options.push(savedDirection);
    els.roleDirection.innerHTML = [
      '<option value="">未分类</option>',
      ...options.map((direction) => {
        const legacyLabel = direction === savedDirection && !plannedRoleDirections.includes(direction) ? "（已移出计划）" : "";
        return `<option value="${escapeHtml(direction)}">${escapeHtml(direction)}${legacyLabel}</option>`;
      })
    ].join("");
    els.roleDirection.value = options.includes(savedDirection) ? savedDirection : "";
    syncSystemSelect(els.roleDirection, true);
    els.roleDirectionHelp.textContent = plannedRoleDirections.length
      ? "选项来自概览页设置的“计划方向”；未选择会归入“未分类”"
      : "请先在概览页设置“计划方向”；当前岗位会归入“未分类”";
  }

  function openDialog(recordId = null, { scheduleOnly = false } = {}) {
    editingId = recordId;
    const record = records.find((item) => item.id === recordId) || null;
    if (scheduleOnly && !record) return;
    jobDialogMode = scheduleOnly ? "schedule" : "full";
    els.dialog.classList.toggle("is-schedule-only", scheduleOnly);
    els.form.reset();
    els.formError.textContent = "";
    els.placeSearchStatus.textContent = "";
    els.jdSourceText.value = "";
    els.jobImportPaste.open = false;
    els.formTitle.textContent = scheduleOnly ? "编辑岗位日程" : record ? "更新岗位与位置" : "新增岗位";
    els.formSubtitle.textContent = scheduleOnly
      ? `${record.company} · ${record.role}；这里只保存客观日程节点`
      : "一条记录对应“公司 × 岗位 × 具体 Base”";
    els.saveButton.textContent = scheduleOnly ? "保存日程" : record ? "保存修改" : "保存记录";
    renderJobRoleDirectionOptions(record);
    populateForm(record);
    draftJobSnapshot = normalizeJdSnapshot(record?.jdSnapshot);
    draftJobImportResult = draftJobSnapshot ? { fields: draftJobSnapshot.fields } : null;
    draftJobEvents = (record?.events || []).map((event) => normalizeEvent({ ...event }));
    closeJobScheduleEditor();
    renderJobScheduleList();
    renderJobImportReview();
    refreshJobImportDuplicates();
    if (draftJobSnapshot) {
      const captured = draftJobSnapshot.capturedAt
        ? new Date(draftJobSnapshot.capturedAt).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })
        : "此前";
      setJobImportState("已有快照", "success", `${captured}已保存 JD 快照；重新识别会替换当前快照和自动识别字段。`);
    } else {
      setJobImportState("等待输入", "", "公开招聘页可直接识别；登录页请展开并粘贴文字。");
    }
    searchResults = [];
    selectedPlaceIndex = -1;
    draftPlaceMeta = record
      ? {
          provider: record.placeProvider || "manual",
          providerPlaceId: record.providerPlaceId || "",
          coordinateSystem: "WGS84",
          providerCoordinateSystem: record.providerCoordinateSystem || "WGS84",
          providerLng: record.providerLng ?? record.lng ?? null,
          providerLat: record.providerLat ?? record.lat ?? null
        }
      : null;
    renderSearchResults();
    if (typeof els.dialog.showModal === "function") els.dialog.showModal();
    else els.dialog.setAttribute("open", "");

    if (scheduleOnly) {
      requestAnimationFrame(() => els.jobScheduleAdd.focus({ preventScroll: true }));
    } else {
      requestAnimationFrame(async () => {
        await ensurePickerMap();
        requestAnimationFrame(() => {
          resizePickerMap();
          const lng = parseCoordinate(els.lng.value, -180, 180);
          const lat = parseCoordinate(els.lat.value, -90, 90);
          if (lng !== null && lat !== null) {
            setPickerPoint(lng, lat, { fly: true, source: "existing", coordinateSystem: "WGS84" });
          } else {
            clearPickerMarker();
          }
        });
      });
      els.company.focus();
    }
  }

  function closeDialog() {
    searchController?.abort();
    searchRequestId += 1;
    clearTimeout(searchTimer);
    if (typeof els.dialog.close === "function") els.dialog.close();
    else els.dialog.removeAttribute("open");
  }

  function handleSave() {
    els.formError.textContent = "";
    if (!els.jobScheduleCompose.hidden) {
      els.formError.textContent = "请先保存或取消正在编辑的日程节点。";
      els.jobScheduleDate.focus();
      return;
    }
    if (jobDialogMode === "schedule") {
      const old = records.find((item) => item.id === editingId);
      if (!old) {
        els.formError.textContent = "没有找到这条岗位记录，请关闭后重试。";
        return;
      }
      const restoreScroll = applicationsScrollBeforeEdit;
      const updated = normalizeRecord({
        ...old,
        events: draftJobEvents.map((event) => normalizeEvent({ ...event })),
        updatedAt: today()
      });
      records = records.map((item) => item.id === old.id ? updated : item);
      selectedId = updated.id;
      saveRecords();
      closeDialog();
      render();
      requestAnimationFrame(() => {
        els.applicationsList.scrollTop = restoreScroll;
        applicationsScrollBeforeEdit = null;
      });
      return;
    }
    if (!els.form.checkValidity()) {
      els.form.reportValidity();
      return;
    }
    const data = Object.fromEntries(new FormData(els.form).entries());
    const duplicateMatches = findJobDuplicates({
      company: data.company,
      role: data.role,
      city: data.city,
      url: data.jdUrl
    });
    if (!editingId && duplicateMatches.length) {
      const duplicate = duplicateMatches[0];
      const confirmed = window.confirm(`可能已经记录过“${duplicate.record.company} · ${duplicate.record.role} · ${duplicate.record.city}”（${duplicate.reason}）。\n\n仍然保存这条记录？`);
      if (!confirmed) {
        refreshJobImportDuplicates();
        return;
      }
    }
    const lng = parseCoordinate(data.lng, -180, 180);
    const lat = parseCoordinate(data.lat, -90, 90);
    if (data.accuracy !== "unknown" && (lng === null || lat === null)) {
      els.formError.textContent = "请先在上方搜索或点选地图位置；如果暂时不知道，只填写 Base 城市即可。";
      return;
    }
    if ((data.lng.trim() && lng === null) || (data.lat.trim() && lat === null)) {
      els.formError.textContent = "经纬度超出有效范围，请重新选择地点。";
      return;
    }

    const old = records.find((item) => item.id === editingId);
    const restoreApplicationsScroll = old && currentAppView === "applications"
      ? applicationsScrollBeforeEdit
      : null;
    const statusLabel = statusMeta[data.stage]?.label || data.stage;
    const eventLabel = `${statusLabel}${data.stageDetail ? ` · ${data.stageDetail}` : ""}`;
    const shouldAddEvent = !old || old.stage !== data.stage || old.stageDetail !== data.stageDetail;
    const placeMeta = draftPlaceMeta || {
      provider: old?.placeProvider || "manual",
      providerPlaceId: old?.providerPlaceId || "",
      coordinateSystem: "WGS84",
      providerCoordinateSystem: old?.providerCoordinateSystem || "WGS84",
      providerLng: old?.providerLng ?? lng,
      providerLat: old?.providerLat ?? lat
    };
    const record = normalizeRecord({
      ...(old || {}),
      id: old?.id || makeId(),
      company: data.company.trim(),
      role: data.role.trim(),
      roleDirection: data.roleDirection.trim(),
      stage: data.stage,
      stageDetail: data.stageDetail.trim(),
      city: data.city.trim(),
      building: data.building.trim(),
      address: data.address.trim(),
      accuracy: data.accuracy,
      locationPreference: data.locationPreference,
      lng: data.accuracy === "unknown" ? null : lng,
      lat: data.accuracy === "unknown" ? null : lat,
      coordinateSystem: "WGS84",
      placeProvider: placeMeta.provider || "manual",
      providerPlaceId: placeMeta.providerPlaceId || "",
      providerCoordinateSystem: placeMeta.providerCoordinateSystem || "WGS84",
      providerLng: data.accuracy === "unknown" ? null : (placeMeta.providerLng ?? lng),
      providerLat: data.accuracy === "unknown" ? null : (placeMeta.providerLat ?? lat),
      priority: data.priority,
      jdUrl: data.jdUrl.trim(),
      jdSnapshot: draftJobSnapshot,
      notes: data.notes.trim(),
      events: draftJobEvents.map((event) => normalizeEvent({ ...event })),
      updatedAt: today(),
      timeline: shouldAddEvent
        ? [{ date: today(), label: old ? `更新为${eventLabel}` : eventLabel }, ...(old?.timeline || [])]
        : (old?.timeline || [])
    });

    if (old) records = records.map((item) => item.id === old.id ? record : item);
    else records = [record, ...records];
    selectedId = record.id;
    saveRecords();
    closeDialog();
    render();
    if (restoreApplicationsScroll !== null) {
      requestAnimationFrame(() => {
        els.applicationsList.scrollTop = restoreApplicationsScroll;
        applicationsScrollBeforeEdit = null;
      });
    }
    if (isMappable(record)) focusRecord(record.id, true);
  }

  function deleteSelectedRecord() {
    const record = records.find((item) => item.id === selectedId);
    if (!record || !window.confirm(`删除“${record.company} · ${record.role}”？此操作无法撤销。`)) return;
    records = records.filter((item) => item.id !== selectedId);
    selectedId = records[0]?.id || null;
    saveRecords();
    render();
    fitVisibleRecords(true);
  }

  function exportRecords() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `校招投递备份-${today()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function enterDashboardView() {
    if (!els.entryScreen || els.entryScreen.hidden) return;
    if (supabaseClient && !authUser && !showcaseDemoActive) {
      openAuthPanel("login");
      return;
    }
    els.entryScreen.classList.add("is-leaving");
    els.entryScreen.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      els.entryScreen.hidden = true;
      els.entryVideo?.pause();
      els.dashboard.classList.add("is-entered");
      setAppView("overview");
      overviewMap?.resize();
      els.overviewAddButton?.focus({ preventScroll: true });
    }, 360);
  }

  function enterShowcaseDemo() {
    if (authUser) {
      enterDashboardView();
      return;
    }
    showcaseDemoSnapshot = {
      records,
      selectedId,
      plannedRoleDirections,
      friendSyncSettings,
      friendPoints
    };
    showcaseDemoActive = true;
    records = createOnboardingDemoRecords();
    selectedId = records[0]?.id || null;
    plannedRoleDirections = ["产品经理", "商业分析", "用户研究", "战略运营"];
    friendSyncSettings = { mySpace: null, subscriptions: [] };
    friendPoints = [];
    setAccountState("demo", "演示模式");
    render();
    enterDashboardView();
  }

  function exitShowcaseDemo() {
    if (!showcaseDemoActive) return;
    const snapshot = showcaseDemoSnapshot;
    showcaseDemoActive = false;
    showcaseDemoSnapshot = null;
    records = snapshot?.records || loadRecords();
    selectedId = snapshot?.selectedId || records[0]?.id || null;
    plannedRoleDirections = snapshot?.plannedRoleDirections || loadCareerDirections();
    friendSyncSettings = snapshot?.friendSyncSettings || loadFriendSyncSettings();
    friendPoints = snapshot?.friendPoints || [];
    showEntryScreen();
    renderAuthState();
    render();
  }

  async function importRecords(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error("not-array");
      const normalized = parsed.filter((item) => item?.company && item?.role).map(normalizeRecord);
      if (!normalized.length) throw new Error("empty");
      if (!window.confirm(`导入 ${normalized.length} 条记录并替换当前数据？`)) return;
      records = normalized;
      selectedId = records[0]?.id || null;
      saveRecords();
      render();
      fitVisibleRecords(true);
    } catch (error) {
      window.alert("无法导入：请选择由本看板导出的 JSON 备份文件。");
    } finally {
      els.importFile.value = "";
    }
  }

  [els.stageFilter, els.cityFilter, els.locationFilter].forEach((control) => {
    control.addEventListener("change", () => {
      render();
      fitVisibleRecords(true);
    });
  });
  els.friendFilter?.addEventListener("change", renderMapMarkers);

  els.appViewButtons.forEach((button) => {
    button.addEventListener("click", () => setAppView(button.dataset.appView));
  });
  els.appActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.appAction === "friends") openFriendsDialog();
    });
  });

  els.entryAuthOpen.addEventListener("click", () => {
    if (!supabaseClient || authUser) enterDashboardView();
    else openAuthPanel("login");
  });
  els.enterDemo.addEventListener("click", enterShowcaseDemo);
  els.authPanelClose.addEventListener("click", closeAuthPanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && authPanelOpen && authMode !== "recovery") closeAuthPanel();
  });

  els.overviewAddButton.addEventListener("click", () => openDialog());
  els.applicationsAddButton.addEventListener("click", () => openDialog());
  els.demoDataClear.addEventListener("click", clearDemoRecords);
  els.careerDirectionsOpen.addEventListener("click", openCareerDirections);
  els.careerDirectionsClose.addEventListener("click", closeCareerDirections);
  els.careerDirectionsSkip.addEventListener("click", closeCareerDirections);
  els.careerDirectionsSave.addEventListener("click", saveCareerDirections);
  els.careerDirectionCustomAdd.addEventListener("click", addCustomCareerDirection);
  els.careerDirectionCustom.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addCustomCareerDirection();
  });
  els.careerDirectionCloud.addEventListener("click", (event) => {
    const bubble = event.target.closest("[data-career-direction]");
    if (!bubble) return;
    const value = bubble.dataset.careerDirection || "";
    if (draftRoleDirections.includes(value)) {
      draftRoleDirections = draftRoleDirections.filter((item) => item !== value);
    } else if (draftRoleDirections.length < 8) {
      draftRoleDirections.push(value);
    } else {
      els.careerDirectionsStatus.textContent = "最多选择 8 个方向，请先取消一个再选择。";
      els.careerDirectionsStatus.dataset.state = "error";
      return;
    }
    renderCareerDirectionCloud();
  });
  els.overviewCalendarButton.addEventListener("click", (event) => openCalendar(null, event.currentTarget));
  els.overviewResearchButton.addEventListener("click", () => setAppView("research"));
  els.overviewPipeline.addEventListener("click", (event) => {
    const button = event.target.closest("[data-overview-stages]");
    if (!button) return;
    applicationsFunnelStages = String(button.dataset.overviewStages || "").split(",").filter(Boolean);
    applicationsFunnelLabel = button.dataset.overviewScopeLabel || "累计阶段";
    applicationsRoleCategory = "";
    applicationsRoleLabel = "";
    els.applicationsStageFilter.value = "all";
    renderApplications();
    setAppView("applications");
  });
  els.overviewAgenda.addEventListener("click", (event) => {
    const button = event.target.closest("[data-overview-event-date]");
    if (button) openCalendar(button.dataset.overviewEventDate, button);
  });
  els.overviewRoleChart.addEventListener("pointerover", (event) => {
    const control = event.target.closest("[data-role-signal]");
    if (control) setRoleSignalHighlight(control);
  });
  els.overviewRoleChart.addEventListener("pointerout", (event) => {
    const control = event.target.closest("[data-role-signal]");
    if (!control) return;
    const nextControl = event.relatedTarget?.closest?.("[data-role-signal]");
    if (nextControl?.dataset.roleSignal === control.dataset.roleSignal) return;
    setRoleSignalHighlight(nextControl || null);
  });
  els.overviewRoleChart.addEventListener("focusin", (event) => {
    const control = event.target.closest("[data-role-signal]");
    if (control) setRoleSignalHighlight(control);
  });
  els.overviewRoleChart.addEventListener("focusout", (event) => {
    const nextControl = event.relatedTarget?.closest?.("[data-role-signal]");
    setRoleSignalHighlight(nextControl || null);
  });
  els.overviewRoleChart.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key) || !event.target.matches(".role-donut-segment")) return;
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  els.overviewRoleChart.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-career-directions]")) {
      openCareerDirections();
      return;
    }
    const button = event.target.closest("[data-role-category]");
    if (!button) return;
    event.preventDefault();
    applicationsRoleCategory = button.dataset.roleCategory || "";
    applicationsRoleLabel = button.dataset.roleLabel || "岗位方向";
    applicationsFunnelStages = null;
    applicationsFunnelLabel = "";
    els.applicationsStageFilter.value = "all";
    els.applicationsQuery.value = "";
    renderApplications();
    setAppView("applications");
  });
  els.applicationsQuery.addEventListener("input", renderApplications);
  els.applicationsList.addEventListener("scroll", () => closeOtherSystemSelects(), { passive: true });
  els.applicationsStageFilter.addEventListener("change", () => {
    applicationsFunnelStages = null;
    applicationsFunnelLabel = "";
    applicationsRoleCategory = "";
    applicationsRoleLabel = "";
    renderApplications();
  });
  els.applicationsScopeClear.addEventListener("click", () => {
    applicationsFunnelStages = null;
    applicationsFunnelLabel = "";
    applicationsRoleCategory = "";
    applicationsRoleLabel = "";
    renderApplications();
  });
  els.applicationsList.addEventListener("change", (event) => {
    const stageSelect = event.target.closest("[data-application-stage]");
    if (stageSelect) updateApplicationStage(stageSelect.dataset.applicationStage, stageSelect.value);
  });
  els.applicationsList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-application-delete]");
    if (deleteButton) {
      deleteApplicationRecord(deleteButton.dataset.applicationDelete);
      return;
    }
    const scheduleButton = event.target.closest("[data-application-schedule]");
    if (scheduleButton) {
      applicationsScrollBeforeEdit = els.applicationsList.scrollTop;
      openDialog(scheduleButton.dataset.applicationSchedule, { scheduleOnly: true });
      return;
    }
    const editButton = event.target.closest("[data-application-edit]");
    if (editButton) {
      applicationsScrollBeforeEdit = els.applicationsList.scrollTop;
      openDialog(editButton.dataset.applicationEdit);
      return;
    }
    const mapButton = event.target.closest("[data-application-open]");
    if (!mapButton) return;
    setAppView("research");
    window.setTimeout(() => focusRecord(mapButton.dataset.applicationOpen, true), 80);
  });

  els.authTabs.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-auth-mode]")?.dataset.authMode;
    if (!mode) return;
    setAuthMode(mode);
    setAuthStatus();
    if (mode === "register") els.authName.focus();
    else els.authEmail.focus();
  });
  els.authForm.addEventListener("submit", submitAuthForm);
  els.authReset.addEventListener("click", sendPasswordReset);
  els.logoutButton.addEventListener("click", signOutCurrentUser);
  els.sidebarProfile.addEventListener("click", openAdminDialog);
  els.adminClose.addEventListener("click", closeAdminDialog);
  els.adminRefresh.addEventListener("click", () => loadAdminSnapshot({ announce: true }));
  els.adminInviteForm.addEventListener("submit", createInviteCode);
  els.adminInviteList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-invite-toggle]");
    if (button) setInviteActive(button.dataset.inviteToggle, button.dataset.nextActive === "true");
  });
  els.adminCopyCode.addEventListener("click", async () => {
    if (!lastCreatedInviteCode) return;
    try {
      await navigator.clipboard.writeText(lastCreatedInviteCode);
      setAdminStatus("邀请码已复制。", "success");
    } catch (error) {
      setAdminStatus(`请手动复制：${lastCreatedInviteCode}`, "error");
    }
  });
  els.adminDialog.addEventListener("click", (event) => {
    if (event.target === els.adminDialog) closeAdminDialog();
  });
  els.adminDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeAdminDialog();
  });
  els.enterDashboard.addEventListener("click", enterDashboardView);
  els.friendsButton.addEventListener("click", openFriendsDialog);
  els.friendsClose.addEventListener("click", closeFriendsDialog);
  els.friendPublish.addEventListener("click", () => publishOwnPoints());
  els.friendRevoke.addEventListener("click", revokeOwnPoints);
  els.friendAdd.addEventListener("click", addFriendSubscription);
  els.friendRefresh.addEventListener("click", () => refreshFriendPoints({ announce: true }));
  els.friendCopyCode.addEventListener("click", async () => {
    const code = friendSyncSettings.mySpace?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setFriendStatus(els.friendPublishStatus, "共享码已复制。发送给朋友后，对方只会看到你的点位。", false);
    } catch (error) {
      setFriendStatus(els.friendPublishStatus, `共享码：${code}`, false);
    }
  });
  els.friendSubscriptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-friend-remove]");
    if (button) removeFriendSubscription(button.dataset.friendRemove);
  });
  els.friendsDialog.addEventListener("click", (event) => {
    if (event.target === els.friendsDialog) closeFriendsDialog();
  });

  els.jobsPanelToggle.addEventListener("click", () => setJobsPanelCollapsed(!jobsPanelCollapsed));
  els.routePanelToggle.addEventListener("click", () => setRoutePanelCollapsed(!routePanelCollapsed));
  els.routeClose.addEventListener("click", closeRoutePlanner);
  els.routeOrigin.addEventListener("click", () => openRoutePicker("origin"));
  els.routeDestination.addEventListener("click", () => openRoutePicker("destination"));
  els.routeSwap.addEventListener("click", swapRouteEndpoints);
  els.routeModeSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route-mode]");
    if (button) setRouteTravelMode(button.dataset.routeMode);
  });
  els.routeSubmit.addEventListener("click", queryRoutes);
  els.routePlaceSearch.addEventListener("click", () => {
    clearTimeout(routePlaceSearchTimer);
    searchRoutePlaces(els.routePlaceQuery.value);
  });
  els.routePlaceQuery.addEventListener("input", () => {
    clearTimeout(routePlaceSearchTimer);
    routePlaceSearchController?.abort();
    routePlaceSearchRequestId += 1;
    const query = els.routePlaceQuery.value.trim();
    renderRoutePickerOptions(query);
    if (query.length < 2) return;
    routePlaceSearchTimer = setTimeout(() => searchRoutePlaces(query), 450);
  });
  els.routePlaceQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(routePlaceSearchTimer);
      searchRoutePlaces(els.routePlaceQuery.value);
    }
  });
  els.routePickerResults.addEventListener("click", (event) => {
    const option = event.target.closest("[data-route-option-index]");
    if (option) chooseRouteEndpoint(routePickerOptions[Number(option.dataset.routeOptionIndex)]);
  });
  els.routeResults.addEventListener("click", (event) => {
    const option = event.target.closest("[data-route-plan-index]");
    if (!option) return;
    selectedRoutePlanIndex = Number(option.dataset.routePlanIndex) || 0;
    renderRouteResults();
    drawSelectedRoute();
  });
  els.calendarOpen?.addEventListener("click", (event) => openCalendar(null, event.currentTarget));
  els.deadlineChart?.addEventListener("click", (event) => {
    const day = event.target.closest("[data-calendar-open-date]");
    if (day) openCalendar(day.dataset.calendarOpenDate, day);
  });
  els.calendarClose.addEventListener("click", closeCalendar);
  els.calendarPrev.addEventListener("click", () => {
    calendarCursor.setMonth(calendarCursor.getMonth() - 1);
    if (calendarAgendaMode !== "all") {
      calendarSelectedDate = dateKey(calendarCursor);
      calendarAgendaMode = "date";
      calendarFocusedEventRef = null;
    }
    closeEventForm();
    renderCalendar();
  });
  els.calendarNext.addEventListener("click", () => {
    calendarCursor.setMonth(calendarCursor.getMonth() + 1);
    if (calendarAgendaMode !== "all") {
      calendarSelectedDate = dateKey(calendarCursor);
      calendarAgendaMode = "date";
      calendarFocusedEventRef = null;
    }
    closeEventForm();
    renderCalendar();
  });
  els.calendarToday.addEventListener("click", () => {
    calendarSelectedDate = today();
    calendarAgendaMode = "date";
    calendarFocusedEventRef = null;
    calendarCursor = parseDate(today());
    calendarCursor.setDate(1);
    closeEventForm();
    renderCalendar();
  });
  els.calendarGrid.addEventListener("click", (event) => {
    const day = event.target.closest("[data-calendar-date]");
    if (!day) return;
    calendarSelectedDate = day.dataset.calendarDate;
    calendarAgendaMode = "date";
    calendarFocusedEventRef = null;
    const selected = parseDate(calendarSelectedDate);
    if (selected.getMonth() !== calendarCursor.getMonth() || selected.getFullYear() !== calendarCursor.getFullYear()) {
      calendarCursor = selected;
      calendarCursor.setDate(1);
    }
    closeEventForm();
    renderCalendar();
  });
  els.agendaShowAll.addEventListener("click", () => {
    calendarAgendaMode = "all";
    calendarFocusedEventRef = null;
    closeEventForm();
    renderCalendar();
  });
  els.eventCancel.addEventListener("click", closeEventForm);
  els.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleEventSave();
  });
  els.agendaList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-event-action]");
    if (!actionButton) return;
    const { eventAction, jobId, eventId } = actionButton.dataset;
    if (eventAction === "focus") {
      const { event: focusedEvent } = findCalendarEvent(jobId, eventId);
      if (!focusedEvent) return;
      calendarAgendaMode = "event";
      calendarFocusedEventRef = { jobId, eventId };
      calendarSelectedDate = focusedEvent.date;
      calendarCursor = parseDate(focusedEvent.date);
      calendarCursor.setDate(1);
      closeEventForm();
      renderCalendar();
    }
    if (eventAction === "toggle") toggleCalendarEvent(jobId, eventId);
    if (eventAction === "edit") openEventForm(jobId, eventId);
    if (eventAction === "delete") deleteCalendarEvent(jobId, eventId);
  });
  els.calendarDialog.addEventListener("click", (event) => {
    if (event.target === els.calendarDialog) closeCalendar();
  });
  els.calendarDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeCalendar();
  });
  els.calendarDialog.addEventListener("close", closeEventForm);
  els.addButton.addEventListener("click", () => openDialog());
  els.dialogClose.addEventListener("click", closeDialog);
  els.jobImportSubmit.addEventListener("click", handleJobImport);
  els.jdUrl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleJobImport();
  });
  [els.company, els.role, els.city, els.jdUrl].forEach((control) => {
    control.addEventListener("input", refreshJobImportDuplicates);
  });
  els.jobScheduleAdd.addEventListener("click", () => openJobScheduleEditor());
  els.jobScheduleCancel.addEventListener("click", closeJobScheduleEditor);
  els.jobScheduleSave.addEventListener("click", saveJobScheduleDraft);
  els.jobScheduleList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-job-schedule-action]");
    if (!actionButton) return;
    const { jobScheduleAction, eventId } = actionButton.dataset;
    if (jobScheduleAction === "edit") openJobScheduleEditor(eventId);
    if (jobScheduleAction === "remove") removeJobScheduleDraft(eventId);
  });
  els.saveButton.addEventListener("click", handleSave);
  els.fitAllButton.addEventListener("click", () => fitVisibleRecords(true));
  els.exportButton.addEventListener("click", exportRecords);
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files?.[0];
    if (file) importRecords(file);
  });

  els.list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-record-id]");
    if (button) focusRecord(button.dataset.recordId, true);
  });

  els.selectionCard.addEventListener("click", (event) => {
    const action = event.target.closest("[data-selection-action]")?.dataset.selectionAction;
    if (action === "route") openRoutePlanner(endpointFromRecord(records.find((item) => item.id === selectedId)));
    if (action === "edit") openDialog(selectedId);
    if (action === "delete") deleteSelectedRecord();
    if (action === "close") {
      selectionCardHidden = true;
      renderSelection();
    }
  });

  els.placeSearchButton.addEventListener("click", () => {
    clearTimeout(searchTimer);
    searchPlaces(els.placeQuery.value);
  });
  els.placeQuery.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchController?.abort();
    searchRequestId += 1;
    els.placeSearchButton.disabled = false;
    const query = els.placeQuery.value.trim();
    if (query.length < 2) {
      searchResults = [];
      renderSearchResults();
      els.placeSearchStatus.textContent = query ? "继续输入以搜索地点。" : "";
      return;
    }
    els.placeSearchStatus.textContent = "正在等待输入完成…";
    searchTimer = setTimeout(() => searchPlaces(query), 500);
  });
  els.placeQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(searchTimer);
      searchPlaces(els.placeQuery.value);
    }
  });
  els.placeResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-place-index]");
    if (button) selectSearchResult(Number(button.dataset.placeIndex));
  });

  [els.lng, els.lat].forEach((control) => {
    control.addEventListener("change", () => {
      const lng = parseCoordinate(els.lng.value, -180, 180);
      const lat = parseCoordinate(els.lat.value, -90, 90);
      if (lng !== null && lat !== null) {
        const [providerLng, providerLat] = pickerProvider === "amap" ? wgs84ToGcj02(lng, lat) : [lng, lat];
        draftPlaceMeta = {
          provider: "manual",
          providerPlaceId: "",
          coordinateSystem: "WGS84",
          providerCoordinateSystem: pickerProvider === "amap" ? "GCJ02" : "WGS84",
          providerLng,
          providerLat
        };
        selectedPlaceIndex = -1;
        setPickerPoint(lng, lat, { fly: true, source: "manual", coordinateSystem: "WGS84" });
        els.accuracy.value = "approximate";
        els.placeSearchStatus.textContent = "已使用手填坐标；请核对地址文字。";
        renderSearchResults();
      }
    });
  });

  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeDialog();
  });

  window.addEventListener("resize", () => {
    syncToolbarClearance();
    mainMap?.resize();
    overviewMap?.resize();
    schedulePointClusterUpdate();
    if (els.dialog.open) resizePickerMap();
  });

  let toolbarClearanceFrame = 0;
  let toolbarResizeObserver = null;

  function syncToolbarClearance() {
    if (!els.toolbar) return;
    cancelAnimationFrame(toolbarClearanceFrame);
    toolbarClearanceFrame = requestAnimationFrame(() => {
      const toolbarBounds = els.toolbar.getBoundingClientRect();
      if (!toolbarBounds.height) return;
      const researchBounds = els.researchView?.getBoundingClientRect();
      const clearance = Math.ceil(toolbarBounds.bottom - (researchBounds?.top || 0) + 10);
      document.documentElement.style.setProperty("--toolbar-clearance", `${clearance}px`);
    });
  }

  function initializeResponsiveLayout() {
    syncToolbarClearance();
    if ("ResizeObserver" in window && els.toolbar) {
      toolbarResizeObserver = new ResizeObserver(syncToolbarClearance);
      toolbarResizeObserver.observe(els.toolbar);
    }
  }

  els.placeProviderChip.textContent = amapConfigured() ? "高德 POI" : "开放地图";
  initializeEntryVideo();
  initializeSystemSelects();
  initializeResponsiveLayout();
  rebuildFriendPointsFromCache();
  render();
  initOverviewMap();
  initMainMap();
  initializeAuth();
  refreshFriendPoints();
  window.setInterval(() => {
    if (!document.hidden) refreshFriendPoints();
  }, 60_000);
})();
