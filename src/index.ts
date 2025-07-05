import {
  Plugin,
  fetchPost,
  confirm,
  fetchSyncPost,
  openTab,
  Setting,
  openMobileFileById,
  getFrontend
} from "siyuan";
import "@/index.scss";
import { Md5 } from "ts-md5";
import TurndownService from 'turndown';
import moment from "moment";
import { readFileSync } from 'fs';

let onSyncEndEvent: EventListener;
const STORAGE_NAME = "flomo-sync-config";
const FLOMO_ASSETS_DIR = "assets/flomo";
const USG = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.76";
const flomoSvg = '<svg t="1750664759813" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15145" width="200" height="200"><path d="M157.711133 0C71.153845 0 0 69.625111 0 156.163048v711.151426c0 87.041064 71.173196 156.685526 157.711133 156.685526h709.100213c86.537937 0 157.188654-69.644462 157.691782-156.163048V156.163048C1023.477521 69.625111 952.826804 0 866.288867 0H157.711133z m340.55929 193.317081h424.252623c0 2.206021-14.842262 25.891717-32.974205 52.596179l-29.95544 44.081713H434.469981l5.418297-8.320955a10486.919515 10486.919515 0 0 1 35.915566-54.473232l22.447228-33.883705z m331.522347 187.453711l-34.212673 52.267211-34.580343 52.867094h-119.744354c-93.581722 0-119.086418 1.567436-116.74494 7.159892 0.464425 1.083659 3.154223 9.520721 4.334637 12.887805a225.091521 225.091521 0 0 1 23.318026 99.657955 225.091521 225.091521 0 0 1-225.09152 225.07217A225.091521 225.091521 0 0 1 101.980082 605.591398a225.091521 225.091521 0 0 1 202.450781-223.466032c3.986318-0.522479 8.824083-0.928851 13.642497-1.354574H829.773419z m-502.740518 110.049474a114.751781 114.751781 0 0 0-80.152088 32.838747c-19.54457 21.537729-33.032258 52.24786-33.032258 79.319992 0 46.249032 42.224011 100.722263 86.692746 111.81042 24.537143 6.134286 57.163029 2.051212 83.461118-10.41087 2.92201-1.373925 5.727914-2.980063 8.456413-4.702307a114.751781 114.751781 0 0 0 38.54731-46.268383 125.975395 125.975395 0 0 0 3.831509-9.675529 114.751781 114.751781 0 0 0 3.09617-10.256062c0.774042-2.902659 1.451329-5.805318 2.01251-8.746679a114.751781 114.751781 0 0 0 1.877053-19.138197 114.751781 114.751781 0 0 0-114.751781-114.751781h-0.019351z" p-id="15146"></path></svg>';
const outOfSyncSvg = '<svg id="Bell" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m9.75,19.5c0-.0996.0065-.1975.0191-.2936s.0314-.1902.0558-.282c.0906-.3406.0849-.5717-.0316-.7176s-.3437-.2068-.6961-.2068h-1.6138c-2.2407,0-3.6215-.2061-4.1872-.7265s-.3161-1.3549.7038-2.6117c.7213-.8888,1.0833-1.336,1.2649-1.8609s.1831-1.1274.1831-2.3268v-.9221c0-1.8093.7333-3.4472,1.919-4.6329s2.8236-1.919,4.6329-1.919,3.4472.7333,4.6329,1.919,1.919,2.8236,1.919,4.6329v.9221c0,1.1994.0014,1.802.1831,2.3269s.5437.9721,1.2649,1.8609c1.0199,1.2568,1.2694,2.0914.7038,2.6117s-1.9465.7265-4.1872.7265h-1.6138c-.3524,0-.5796.0608-.6961.2068s-.1222.3771-.0316.7176c.0244.0918.0432.1859.0558.282s.0191.194.0191.2936c0,.6213-.2518,1.1838-.659,1.591s-.9697.659-1.591.659-1.1838-.2518-1.591-.659-.659-.9697-.659-1.591Z"/></svg>';

export default class FlomoSync extends Plugin {
  private isMobile: boolean;
  private siyuanStorage;
  private topBarElement;
  private syncing: boolean = false;

  /**
   * 格式化日期为 YYYY-MM-DD 格式
   * @param timeString 时间字符串或时间戳
   * @returns 格式化后的日期字符串
   */
  formatDate(timeString) {
    // 如果传入的是moment对象，直接格式化
    if (moment.isMoment(timeString)) {
      return timeString.format('YYYY-MM-DD');
    }
    
    // 如果传入的是字符串，先解析
    if (typeof timeString === 'string') {
      const parsed = moment(timeString);
      if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD');
      }
    }
    
    // 如果传入的是数字（Unix时间戳），转换为毫秒
    if (typeof timeString === 'number') {
      const timestamp = timeString < 10000000000 ? timeString * 1000 : timeString;
      return moment(timestamp).format('YYYY-MM-DD');
    }
    
    // 默认返回当前日期
    return moment().format('YYYY-MM-DD');
  }

  /**
   * 转换为中国时区时间
   * @param timeString 时间字符串
   * @returns 格式化后的中国时区时间
   */
  toChinaTime(timeString) {
    return moment(timeString).utcOffset('+08:00').format('YYYY-MM-DD HH:mm:ss');
  }

  async pushMsg(msg) {
    fetchPost("/api/notification/pushMsg", { msg: msg });
  }

  async pushErrMsg(msg) {
    fetchPost("/api/notification/pushErrMsg", { msg: msg });
  }

  async getLocalStorage() {
    return await fetchSyncPost("/api/storage/getLocalStorage");
  }

  /**
   * 
   * @param type
   * @returns 
   */
  getSvgHTML(type){
    let svg;
    if(type === "flomo"){
      svg = flomoSvg
    }else if(type === "outOfSync"){
      svg = outOfSyncSvg
    }else if(type === "iconRefresh"){
      svg = '<svg><use xlink:href="#iconRefresh"></use></svg>'
    } 

    if(this.isMobile){
     svg = svg + '<span class="b3-menu__label">flomo同步</span>'
    }
    return svg;
  }

/**
 * 
 * @param callFun 将回调变为异步函数
 * @param success 
 * @param fail 
 * @param args 
 * @returns 
 */
  async waitFunction(callFun, success, fail, ...args) {
    return new Promise((resolve) => {
      callFun(...args, (...result) => {
        resolve(success(...result));
      }, (...result) => {
        resolve(fail(...result));
      });
    });
  }
  /**
   * 获取所有记录：上次同步时间作为起点
   */
  async getLatestMemos() {
    let allRecords = [];
    let syncSuccessTag = this.data[STORAGE_NAME]["syncSuccessTag"]
    let lastSyncTime = this.data[STORAGE_NAME]["lastSyncTime"]

    let syncTagMode = this.data[STORAGE_NAME].syncTagMode;
    let syncIncludeTags = this.data[STORAGE_NAME].syncIncludeTags;//包含标签字符串
    let syncExcludeTags = this.data[STORAGE_NAME].syncExcludeTags;//排除标签字符串

    let syncIncludeTagsArr = syncIncludeTags === "" ? [] : syncIncludeTags.split(/\s+/)
    let syncExcludeTagsArr = syncExcludeTags === "" ? [] : syncExcludeTags.split(/\s+/)


    const LIMIT = "200";
    let today = new Date();
    //只能是指定时间或今天00:00:00
    let latest_updated = moment(lastSyncTime, 'YYYY-MM-DD HH:mm:ss').toDate()
      || moment(today, 'YYYY-MM-DD 00:00:00').toDate()
    let latest_updated_at_timestamp;
    let latest_slug = "";
    
    while (true) {
      try {
        latest_updated_at_timestamp = (Math.floor(latest_updated.getTime()) / 1000).toString();
        let ts = Math.floor(Date.now() / 1000).toString();
        // let signString;
        // if (!latest_slug) {
        //   signString = `api_key=flomo_web&app_version=2.0&latest_updated_at=${latest_updated_at_timestamp}&limit=${LIMIT}&timestamp=${ts}&tz=8:0&webp=1dbbc3dd73364b4084c3a69346e0ce2b2`
        // } else {
        //   signString = `api_key=flomo_web&app_version=2.0&latest_slug=${latest_slug}&latest_updated_at=${latest_updated_at_timestamp}&limit=${LIMIT}&timestamp=${ts}&tz=8:0&webp=1dbbc3dd73364b4084c3a69346e0ce2b2`
        // }
        // let sign = new Md5().appendStr(signString).end();        
        // let url = "https://flomoapp.com/api/v1/memo/updated/?limit=" + LIMIT + "&latest_updated_at=" + latest_updated_at_timestamp + "&latest_slug=" + latest_slug + "&tz=8:0&timestamp=" +
        //   ts + "&api_key=flomo_web&app_version=2.0&webp=1&sign=" + sign;

        let param = {
          api_key: "flomo_web",
          app_version: "2.0",
          latest_slug: latest_slug,
          latest_updated_at: latest_updated_at_timestamp,
          limit: LIMIT,
          timestamp: ts,
          tz: "8:0",
          webp: "1"
        }
        param["sign"] = this.createSign2(param);
        let url = new URL("https://flomoapp.com/api/v1/memo/updated");
        url.search = new URLSearchParams(param).toString();

        let response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.data[STORAGE_NAME]["accessToken"]}`,
            'Content-Type': 'application/json',
            'User-Agent': USG
          },
        })
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // if (data.code !== 0) {
        //   throw new Error(`错误: ${data.message}`);
        // }
        
        if (this.check_authorization_and_reconnect(data)) {
          // console.log(data);
          let records = data["data"];
          let noMore = records.length < LIMIT;
          if (records.length == 0) {
            break
          }
          
          // 临时调试：查看第一个memo的数据结构
          if (allRecords.length === 0 && records.length > 0) {
            console.log("第一个memo的数据结构:", records[0]);
            console.log("创建时间字段:", {
              created_at: records[0].created_at,
              created: records[0].created,
              updated_at: records[0].updated_at
            });
          }
          
          latest_updated = moment(records[records.length - 1]["updated_at"], 'YYYY-MM-DD HH:mm:ss').toDate()
          latest_slug = records[records.length - 1]["slug"]

          //过滤已删除的（回收站的）,过滤包含同步标识的
          allRecords = allRecords.concat(records.filter(record => {
            return !record["deleted_at"] && !record["tags"].includes(syncSuccessTag);
          }));

          // 过滤标签
          if (syncTagMode === "0") {
            // 排除同步标签
            allRecords = allRecords.filter(record => {
              let memoTags = record["tags"];
              if (memoTags.length == 0) {
                return true
              }

              return syncExcludeTagsArr.every(myTag => memoTags.includes(myTag) == false)
            });

          } else {// if(syncTagMode === "1"){
            // 包含同步标签
            allRecords = allRecords.filter(record => {
              let memoTags = record["tags"];
              return syncIncludeTagsArr.some(myTag => memoTags.includes(myTag))
            });
          }

          if (noMore) { //没有更多了
            break
          }
        } else {
          throw new Error(`flomo登录校验失败`);
        }

      } catch (error) {
        await this.pushErrMsg("plugin-flomo-sync:" + "请检查错误：" + error)
        throw new Error(`${error}`);
      }
    }

    return allRecords;
  }


  /**
   * 开始同步
   */
  async runSync() {
    // 防止快速点击、或手动和自动运行冲突。
    if (this.syncing == true) {
      // console.log("plugin-flomo-sync:" + "正在同步，请稍后")
      return;
    }

    this.syncing = true;
    let runBeforeSvg = this.topBarElement.innerHTML;
    try {
      await this.initData();

      //正在执行的图标
      this.topBarElement.innerHTML = this.getSvgHTML("iconRefresh")
      let memos = await this.getLatestMemos();
      // console.log(memos);      
      if (memos.length == 0) {
        let nowTimeText = moment().format('YYYY-MM-DD HH:mm:ss');
        console.warn("plugin-flomo-sync:" + "暂无新数据-" + nowTimeText)
        this.syncing = false;
        this.topBarElement.innerHTML = this.getSvgHTML("flomo")
        return;
      }

      //生成markdown 和图片
      let { processedMemos, imgs } = this.handleMarkdown(memos)

      // 处理图片：下载图片到思源
      let handleImgSuccess = await this.downloadImgs(imgs)

      // 处理内容：写入思源
      let handleContentSuccess;
      if (handleImgSuccess) {
        // console.log(contentArr)
        handleContentSuccess = await this.writeSiyuan(processedMemos);
      }

      // 回写标签    
      if (handleContentSuccess && handleImgSuccess) {
        await this.writeBackTag(memos);
      }

      // 记录同步时间,间隔1秒
      await setTimeout(async () => {
        // console.log("记录同步时间：");
        let nowTimeText = moment().format('YYYY-MM-DD HH:mm:ss');
        // console.log(nowTimeText);
        this.data[STORAGE_NAME]["lastSyncTime"] = nowTimeText;
        await this.saveData(STORAGE_NAME, this.data[STORAGE_NAME]);
      }, 1000)

      //完成后图标
      this.topBarElement.innerHTML = this.getSvgHTML("flomo")
    } catch (error) {
      //报错图标就恢复成之前的状态
      this.topBarElement.innerHTML = runBeforeSvg
      throw new Error(error)
      // this.syncing = false;
    } finally {
      this.syncing = false;
    }

  }


  /**根据待同步的内容，生成markdown */
  handleMarkdown(memos) {
    let processedMemos = []
    let imgs = []
    let contentTemplate = this.data[STORAGE_NAME].contentTemplate || "> ${time} ${tags}  ${content}";
    
    memos.forEach((memo) => {
      let content = memo.content;
      let files = memo.files;
      imgs = imgs.concat(files);
      files.forEach(img => {
        let imgName = img["name"];
        // 如果imgName是URL，取最后一段
        if (imgName && imgName.startsWith("http")) {
          try {
            const urlObj = new URL(imgName);
            imgName = urlObj.pathname.split('/').pop() || 'img';
          } catch {
            imgName = 'img';
          }
        }
        // 如果没有后缀，默认加 .png
        if (!(/\.(png|jpg|jpeg|gif)$/i.test(imgName))) {
          imgName = imgName + '.png';
        }
        let imgMd = "![" + imgName + "](" + FLOMO_ASSETS_DIR + "/" + img["id"] + "_" + imgName + ") ";
        content += imgMd;
        // 日志：输出图片链接和图片名
        console.log(`[FlomoSync] memo图片: name=${img["name"]}, url=${img["url"]}, markdownName=${imgName}`);
      })
      content = content.trim()
      content = new TurndownService().turndown(content);
      content = content.replaceAll('\\[', '[').replaceAll('\\]', ']').replaceAll('\\_', '_').replaceAll(/(?<=#)(.+?)(?=\s)/g, "$1#");
      
      // 只用 updated_at 字段
      let updatedAt = memo.updated_at;
      let parsedTime = null;
      if (updatedAt) {
        if (typeof updatedAt === 'number') {
          parsedTime = moment.unix(updatedAt);
        } else if (typeof updatedAt === 'string') {
          parsedTime = moment(updatedAt);
          if (!parsedTime.isValid()) {
            let timestamp = parseInt(updatedAt);
            if (!isNaN(timestamp)) {
              parsedTime = moment.unix(timestamp);
            }
          }
        }
      }
      if (!parsedTime || !parsedTime.isValid()) {
        // 跳过无效更新时间的 memo
        return;
      }
      let time = this.toChinaTime(parsedTime);
      let updatedDate = this.formatDate(parsedTime);
      let tags = memo.tags && memo.tags.length > 0 ? '#' + memo.tags.join(' #') : '';
      let processedContent;
      if (content.includes('\n')) {
        let lines = content.split('\n');
        let baseTemplate = contentTemplate
          .replace(/\${time}/g, time)
          .replace(/\${tags}/g, tags)
          .replace(/\${content}/g, lines[0]);
        let contentPrefix = '';
        let templateLines = contentTemplate.split('\n');
        for (let templateLine of templateLines) {
          if (templateLine.includes('${content}')) {
            let match = templateLine.match(/^(\s*[^\s]*)\s*\${content}/);
            if (match) {
              contentPrefix = match[1];
            }
            break;
          }
        }
        let remainingLines = lines.slice(1).map(line => {
          return contentPrefix + line;
        });
        processedContent = baseTemplate + '\n' + remainingLines.join('\n');
      } else {
        processedContent = contentTemplate
          .replace(/\${time}/g, time)
          .replace(/\${tags}/g, tags)
          .replace(/\${content}/g, content);
      }
      processedMemos.push({
        content: processedContent,
        time: time,
        updatedDate: updatedDate, // 只用更新时间
        updatedAt: parsedTime.valueOf(),
        originalMemo: memo
      });
    })
    return { processedMemos, imgs }
  }


  /**
   * 
   * @param imgs 下载图片到思源
   */
  async downloadImgs(imgs) {
    // 处理图片逻辑
    try {
      for (const img of imgs) {
        let imgName = img["name"];
        // 如果imgName是URL，取最后一段
        if (imgName && imgName.startsWith("http")) {
          try {
            const urlObj = new URL(imgName);
            imgName = urlObj.pathname.split('/').pop() || 'img';
          } catch {
            imgName = 'img';
          }
        }
        // 如果没有后缀，默认加 .png
        if (!(/\.(png|jpg|jpeg|gif)$/i.test(imgName))) {
          imgName = imgName + '.png';
        }
        // 修正：保存到data/assets/flomo/...
        let imgPath = "data/" + FLOMO_ASSETS_DIR + "/" + img["id"] + "_" + imgName;
        console.log(`[FlomoSync] 开始下载图片: name=${img["name"]}, url=${img["url"]}, 保存路径=${imgPath}`);
        let imgRespon;
        try {
          imgRespon = await fetch(img["url"]);
          console.log(`[FlomoSync] fetch图片响应: status=${imgRespon.status}, ok=${imgRespon.ok}`);
        } catch (fetchErr) {
          console.error(`[FlomoSync] fetch图片异常:`, fetchErr);
          continue;
        }
        let fileBlob;
        try {
          fileBlob = await imgRespon.blob();
          console.log(`[FlomoSync] 图片blob类型:`, fileBlob.type, `大小:`, fileBlob.size);
        } catch (blobErr) {
          console.error(`[FlomoSync] 解析图片blob异常:`, blobErr);
          continue;
        }
        try {
          const addFileResult = await this.addFile(imgPath, fileBlob);
          console.log(`[FlomoSync] addFile结果:`, addFileResult);
          // 检查文件是否真的存在
          const checkFile = await fetchSyncPost('/api/file/getFile', { path: imgPath });
          console.log('[FlomoSync] getFile 检查:', imgPath, checkFile);
        } catch (addFileErr) {
          console.error(`[FlomoSync] addFile异常:`, addFileErr);
        }
      }
    } catch (error) {
      await this.pushErrMsg("plugin-flomo-sync:" + error)
      return false;
    }
    return true;
  }

  async addFile(f, file) {
    const fd = new FormData();
    fd.append('path', f);
    fd.append('isDir', 'false');
    fd.append('file', file);
    return await fetch('/api/file/putFile', {
      method: 'POST',
      body: fd
    });
  }

  /**
   * 
   * @param memos 回写标签到flomo：标识已同步
   * @param syncSuccessTag 
   */
  async writeBackTag(memos: any[]) {
    let syncSuccessTag = this.data[STORAGE_NAME]["syncSuccessTag"]
    if (!syncSuccessTag) {
      return
    }

    // let config = this.data[STORAGE_NAME];
    let baseUrl = "https://flomoapp.com/api/v1/memo"
    memos.every(async memo => {
      let nowTime = Date.now();
      let timestamp = Math.floor(nowTime / 1000).toFixed();
      // console.log("最后回写标签时间");
      // console.log(new Date(nowTime));
      let url = baseUrl + "/" + memo["slug"];
      // let sign = this.createSign(config.username, config.password, timestamp);
      let addTag1 = `<p>#${syncSuccessTag} `
      let addTag2 = `<p>#${syncSuccessTag} </p>`
      let content = memo["content"].includes("<p>") ?
        memo["content"].replace("<p>", addTag1) :
        addTag2.concat(memo["content"])
      let file_ids = memo["files"].map(file => file.id);
      
      // 根据API文档，使用created_at字段获取创建时间
      let created_at = memo["created_at"] || memo["created"];
      
      let data = {
        api_key: "flomo_web",
        app_version: "2.0",
        content: content,
        created_at: created_at,
        file_ids: file_ids,
        local_updated_at: timestamp,
        platform: "web",
        // sign: sign,
        timestamp: timestamp,
        tz: "8:0",
        webp: "1"
      }
      data["sign"] = this.createSign2(data);
      let response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.data[STORAGE_NAME]["accessToken"]}`,
          'Content-Type': 'application/json',
          'User-Agent': USG
        },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const resPon = await response.json();
      // debugger;
      if (this.check_authorization_and_reconnect(resPon)) {
        // console.log(resPon);
      }
      // 处理逻辑：间隔1秒发请求，防止太快
      setTimeout(() => { }, 1000)
    })
  }

  /**
   * 处理监听同步事件
   */
  async eventBusHandler() {
    // await this.runSync();
    //获取flomo是否有新数据。
    await this.checkNew()
  }


  async checkNew() {
    let memos = await this.getLatestMemos();
    if (memos.length > 0) {
      this.topBarElement.innerHTML = this.getSvgHTML("outOfSync")
    }
  }


  //默认数据
  async initData() {
    this.data[STORAGE_NAME] = await this.loadData(STORAGE_NAME) || {};

    let defaultConfig = {
      username: "",//用户名
      password: "",//密码
      lastSyncTime: moment().format("YYYY-MM-DD 00:00:00"),//上次同步时间
      syncSuccessTag: "",//同步成功标签
      // isAutoSync: false,//是否绑定思源的同步
      accessToken: "",//accessToken

      locationMode: "0",
      dailnoteNotebook: "",
      pageId: "",

      syncTagMode: "0",
      syncIncludeTags: "",
      syncExcludeTags: "",

      contentTemplate: "> ${time} ${tags}  ${content}",//内容模板
      
      memosSort: "asc",//memos排序方式：asc升序，desc降序

    }

    let d = this.data[STORAGE_NAME];
    for (let k in defaultConfig) {
      if (d[k] === undefined || d[k] === "undefined") {
        d[k] = defaultConfig[k];

        if (k === "dailnoteNotebook") {
          if (d["locationMode"] == "0") {
            //取默认数据库
            d[k] = this.siyuanStorage["local-dailynoteid"];
          }
        }
      }else if(k === "lastSyncTime"){
        if(!d[k]){
          d[k] = defaultConfig[k];
        }
      }
    }
  }


  async onload() {
    let conResponse = await this.getLocalStorage();
    this.siyuanStorage = conResponse["data"];
    // 加载配置数据
    await this.initData();
    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    onSyncEndEvent = this.eventBusHandler.bind(this);
    // if (this.data[STORAGE_NAME].isAutoSync) {
      this.eventBus.on("sync-end", onSyncEndEvent);
    // }

    // console.log(this.siyuanStorage);
    this.topBarElement = this.addTopBar({
      icon: flomoSvg,
      title: "flomo同步",
      position: "right",
      callback: await this.runSync.bind(this),
    });

    let usernameElement = document.createElement("textarea");
    let passwordElement = document.createElement("textarea");
    // let isAutoSyncElement = document.createElement('input');
    let lastSyncTimeElement = document.createElement('textarea');
    let syncSuccessTagElement = document.createElement('textarea');
    let accessTokenElement = document.createElement('textarea');

    let locationModeElement;//写入思源位置方案
    let dailnoteNotebookElement = document.createElement('textarea');
    let pageIdElement = document.createElement('textarea');

    let syncTagModeElement;
    let syncIncludeTagsElement = document.createElement('textarea');
    let syncExcludeTagsElement = document.createElement('textarea');

    let contentTemplateElement = document.createElement('textarea');
    let memosSortElement;

    this.setting = new Setting({
      width: '900px',
      height: '700px',
      confirmCallback: async () => {
        let d = this.data[STORAGE_NAME];
        // if (isAutoSyncElement.checked != this.data[STORAGE_NAME].isAutoSync) {
        //   if (isAutoSyncElement.checked) {
        //     this.eventBus.on("sync-end", this.eventBusHandler.bind(this));
        //   } else {
        //     this.eventBus.off("sync-end", this.eventBusHandler.bind(this));
        //   }
        // }

        if (!pageIdElement.value && locationModeElement.value == "1") {
          this.pushErrMsg("同步到指定文档需要配置文档id")
          // return false;
        }

        if (syncSuccessTagElement.value.length != 0) {
          if (syncSuccessTagElement.value.includes(" ")) {
            this.pushErrMsg("同步成功标签不能包含空格，也不能有多个，请重新配置")
          }

          if (d.syncSuccessTag === "") {
            //加强提醒
            let isAgree = await this.waitFunction(
              confirm, () => true, () => false,
              `温馨提示`,
              `将同步成功的标签${syncSuccessTagElement.value}回写进flomo后该插件不能撤销，是否同意写入？`
            );
            if (!isAgree) {
              syncSuccessTagElement.value = ""
            }
          }
        }


        d.username = usernameElement.value;
        d.password = passwordElement.value;
        // d.isAutoSync = isAutoSyncElement.checked;
        d.lastSyncTime = lastSyncTimeElement.value;
        d.syncSuccessTag = syncSuccessTagElement.value;
        d.accessToken = accessTokenElement.value;

        d.locationMode = locationModeElement.value;
        d.dailnoteNotebook = dailnoteNotebookElement.value;
        d.pageId = pageIdElement.value;
        d.syncTagMode = syncTagModeElement.value;
        d.syncIncludeTags = syncIncludeTagsElement.value;
        d.syncExcludeTags = syncExcludeTagsElement.value;
        d.contentTemplate = contentTemplateElement.value;
        d.memosSort = memosSortElement.value;
        await this.saveData(STORAGE_NAME, d);
      }
    });

    // 账号登录类型
    this.setting.addItem({
      title: "账号<code class='fn__code'>必填项</code>",
      description: "请输入flomo的手机号或邮箱",
      createActionElement: () => {
        usernameElement.className = "b3-text-field fn__block";
        usernameElement.placeholder = "手机或邮箱";
        usernameElement.value = this.data[STORAGE_NAME].username;
        return usernameElement;
      },
    });

    this.setting.addItem({
      title: "密码<code class='fn__code'>必填项</code>",
      createActionElement: () => {
        passwordElement.className = "b3-text-field fn__block";
        passwordElement.placeholder = "请输入密码";
        passwordElement.value = this.data[STORAGE_NAME].password;
        return passwordElement;
      },
    });

    this.setting.addItem({
      title: "accessToken",
      description: "一般不填，也不修改，除非登录不起作用时可手动更改",
      createActionElement: () => {
        accessTokenElement.className = "b3-text-field fn__block";
        accessTokenElement.value = this.data[STORAGE_NAME].accessToken;
        return accessTokenElement;
      },
    });

    let today = moment().format("YYYY-MM-DD 00:00:00");
    this.setting.addItem({
      title: "上次同步时间",
      description: `为空则默认为今天0点，${today}，并会自动记录本次同步时间`,
      createActionElement: () => {
        lastSyncTimeElement.className = "b3-text-field fn__block";
        lastSyncTimeElement.placeholder = "如有特殊要求可指定上次同步时间";
        lastSyncTimeElement.value = this.data[STORAGE_NAME].lastSyncTime;
        return lastSyncTimeElement;
      },
    });

    // 同步设置类型
    this.setting.addItem({
      title: "内容模板",
      description: "支持变量：${time} 创建时间，${content} 内容，${tags} 标签。例如：\"> ${time} ${tags}  ${content}\"",
      createActionElement: () => {
        contentTemplateElement.className = "b3-text-field fn__block";
        contentTemplateElement.placeholder = "请输入内容模板，例如：\"> ${time} ${tags}  ${content}\"";
        contentTemplateElement.value = this.data[STORAGE_NAME].contentTemplate || "> ${time} ${tags}  ${content}";
        contentTemplateElement.rows = 3;
        return contentTemplateElement;
      },
    });

    this.setting.addItem({
      title: "memos排序方式",
      description: "当选择'指定笔记本daily note中'时，可以设置memos的排序方式",
      createActionElement: () => {
        memosSortElement = document.createElement('select');
        memosSortElement.className = "b3-select fn__flex-center fn__size200";
        let options = [
          {
            val: "asc",
            text: "升序（时间从早到晚）"
          },
          {
            val: "desc",
            text: "降序（时间从晚到早）"
          }
        ]
        for (let option of options) {
          let optionElement = document.createElement('option');
          optionElement.value = option.val;
          optionElement.text = option.text;
          memosSortElement.appendChild(optionElement);
        }
        memosSortElement.value = this.data[STORAGE_NAME].memosSort || "asc";
        return memosSortElement;
      }
    });

    // 写入思源位置方案
    this.setting.addItem({
      title: "写入思源位置方案",
      description: "放在指定库的daily notes中，或指定文档中",
      createActionElement: () => {
        locationModeElement = document.createElement('select')
        locationModeElement.className = "b3-select fn__flex-center fn__size200";
        let options = [
          {
            val: "0",
            text: "指定笔记本daily note中"
          },
          {
            val: "1",
            text: "指定文档中"
          }
        ]
        for (let option of options) {
          let optionElement = document.createElement('option');
          optionElement.value = option.val;
          optionElement.text = option.text;
          locationModeElement.appendChild(optionElement);
        }
        locationModeElement.value = this.data[STORAGE_NAME].locationMode;
        // 动态显示/隐藏相关输入框
        locationModeElement.addEventListener('change', () => {
          if (locationModeElement.value === "0") {
            dailnoteNotebookElement.parentElement.style.display = '';
            pageIdElement.parentElement.style.display = 'none';
          } else {
            dailnoteNotebookElement.parentElement.style.display = 'none';
            pageIdElement.parentElement.style.display = '';
          }
        });
        return locationModeElement;
      }
    });

    // dailynote笔记本id
    this.setting.addItem({
      title: "dailynote笔记本id",
      description: "获取方式：右击文档树的笔记本，打开文件位置，其路径id就是",
      createActionElement: () => {
        dailnoteNotebookElement.className = "b3-text-field fn__block";
        dailnoteNotebookElement.placeholder = "请输入dailynote笔记本id，如：\"20230307225200-d5v9wrx\" ";
        dailnoteNotebookElement.value = this.data[STORAGE_NAME].dailnoteNotebook;
        // 默认只在locationMode为0时显示
        setTimeout(() => {
          dailnoteNotebookElement.parentElement.style.display = (locationModeElement.value === "0") ? '' : 'none';
        }, 0);
        return dailnoteNotebookElement;
      },
    });

    // 指定文档id
    this.setting.addItem({
      title: "指定文档id",
      description: "填写指定定文档id",
      createActionElement: () => {
        pageIdElement.className = "b3-text-field fn__block";
        pageIdElement.placeholder = "请输入";
        pageIdElement.value = this.data[STORAGE_NAME].pageId;
        // 默认只在locationMode为1时显示
        setTimeout(() => {
          pageIdElement.parentElement.style.display = (locationModeElement.value === "1") ? '' : 'none';
        }, 0);
        return pageIdElement;
      },
    });

    // 同步标签方案
    this.setting.addItem({
      title: "同步标签方案",
      description: "两种方案，排除标签（默认），包含标签",
      createActionElement: () => {
        syncTagModeElement = document.createElement('select');
        syncTagModeElement.className = "b3-select fn__flex-center fn__size200";
        let options = [
          {
            val: "0",
            text: "排除标签"
          },
          {
            val: "1",
            text: "包含标签"
          }
        ]
        for (let option of options) {
          let optionElement = document.createElement('option');
          optionElement.value = option.val;
          optionElement.text = option.text;
          syncTagModeElement.appendChild(optionElement);
        }
        syncTagModeElement.value = this.data[STORAGE_NAME].syncTagMode;
        return syncTagModeElement;
      }
    });

    this.setting.addItem({
      title: "同步包含标签",
      description: "包含以下标签才会同步进来，<code class='fn__code'>和排除标签互斥，选一即可</code>。中间用空格隔开。注意：不要加#",
      createActionElement: () => {
        syncIncludeTagsElement.className = "b3-text-field fn__block";
        syncIncludeTagsElement.placeholder = "请输入同步包含标签，如：\"工作 收集箱\" ";
        syncIncludeTagsElement.value = this.data[STORAGE_NAME].syncIncludeTags;
        return syncIncludeTagsElement;
      },
    });

    this.setting.addItem({
      title: "同步排除标签",
      description: "除以下标签外才会同步进来，<code class='fn__code'>和包含标签互斥，选一即可</code>。中间用空格隔开。注意：不要加#",
      createActionElement: () => {
        syncExcludeTagsElement.className = "b3-text-field fn__block";
        syncExcludeTagsElement.placeholder = "同步排除标签，如：\"草稿 已同步\" ";
        syncExcludeTagsElement.value = this.data[STORAGE_NAME].syncExcludeTags;
        return syncExcludeTagsElement;
      },
    });

    // 回写同步成功标签
    this.setting.addItem({
      title: "回写同步成功标签",
      description: `将同步的记录，加一个同步后标签标识写入flomo，为空则不加。温馨提示：1. 不要加# 2.<code class="fn__code">回写flomo成功后不能批量去掉标签，根据需要谨慎填写</code>` ,
      createActionElement: () => {
        syncSuccessTagElement.className = "b3-text-field fn__block";
        syncSuccessTagElement.placeholder = "请输入回写同步成功标签，如：\"已同步\" ";
        syncSuccessTagElement.value = this.data[STORAGE_NAME].syncSuccessTag;
        return syncSuccessTagElement;
      },
    });

    //判断是否有新数据
    await this.checkNew()
  }

  async onunload() {
    this.eventBus.off("sync-end", this.eventBusHandler.bind(this));
    this.syncing = false;
  }

  async onLayoutReady() {
    // console.log("onLayoutReady");
    if (!this.data[STORAGE_NAME].accessToken) {
      await this.connect();
    }
  }

  // 连接flomo
  async connect() {
    let config = this.data[STORAGE_NAME];
    if (!config.username || !config.password) {
      await this.pushErrMsg("plugin-flomo-sync:" + "用户名或密码为空，重新配置后再试")
    }
    let timestamp = Math.floor(Date.now() / 1000).toFixed();
    // let sign = this.createSign(config.username, config.password, timestamp);
    let url = "https://flomoapp.com/api/v1/user/login_by_email"
    let data = {
      "api_key": "flomo_web",
      "app_version": "2.0",
      "email": config.username,
      "password": config.password,
      // "sign": sign,
      "timestamp": timestamp,
      "webp": "1",
    }
    data["sign"] = this.createSign2(data);
    try {
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.data[STORAGE_NAME]["accessToken"]}`,
          'Content-Type': 'application/json',
          'User-Agent': USG
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const resData = await response.json();
      // console.log(resData);
      if (resData.code == -10) {
        throw new Error(`同步失败，请重试：${resData.message}`);
      } else if (resData.code == -1) {
        throw new Error(`请检查用户名和密码，或手动更新accessToken后再试`);
      } else if (resData.code !== 0) {
        throw new Error(`Server error! msg: ${resData.message}`);
      } else {
        // 登录成功 ，刷新AccessToken
        this.data[STORAGE_NAME]["accessToken"] = resData.data["access_token"];
        await this.saveData(STORAGE_NAME, this.data[STORAGE_NAME]);
      }
      return true;
    } catch (error) {
      await this.pushErrMsg("plugin-flomo-sync:" + error);
      return false;
    }
  }


  // createSign(username, password, timestamp) {
  //   let words = `api_key=flomo_web&app_version=2.0&email=${username}&password=${password}&timestamp=${timestamp}&webp=1dbbc3dd73364b4084c3a69346e0ce2b2`
  //   let sign = new Md5().appendStr(words).end();
  //   // console.log(sign);
  //   return sign;
  // }

  createSign2(param){
    //from flomo web
    const SECRET = 'dbbc3dd73364b4084c3a69346e0ce2b2'
    const sortParam = {};
    Object.keys(param).sort().forEach(function(key) {
      sortParam[key] = param[key];
    });

    let paramString = ''
    for (let key in sortParam) {
      let value = sortParam[key]
      if (typeof value === 'undefined' || (!value && value !== 0)) continue

      if (Array.isArray(value)) {
        value.sort(function (a, b) {
          return a && b ? a.toString().localeCompare(b.toString()) : 0
        })

        for (let index in value) {
          let v = value[index]
          paramString += key + '[]=' + v + '&'
        }
      } else {
        paramString += key + '=' + value + '&'
      }
    }
    paramString = paramString.substring(0, paramString.length - 1)
    let sign = new Md5().appendStr(paramString + SECRET).end();
    return sign
  }

  async check_authorization_and_reconnect(resData) {
    // 检测到accessToken失效就提示，就重新登录
    if (resData.code == -10) {
      // 重新登录
      await this.connect();
      await this.pushErrMsg(`正重新登录，请重新再试`);
      return false;
    } else if (resData.code !== 0) {
      await this.pushErrMsg(`Server error! msg: ${resData.message}`);
      // throw new Error(`Server error! msg: ${resData.message}`);
    }
    return resData.code == 0;
  }

  /**把内容写进今日日记中（已改为按更新时间分组和写入） */
  async writeSiyuan(processedMemos) {
    try {
      let locationMode = this.data[STORAGE_NAME].locationMode;
      let notebook = this.data[STORAGE_NAME].dailnoteNotebook;
      let memosSort = this.data[STORAGE_NAME].memosSort || "asc";
      console.log("[FlomoSync] writeSiyuan: locationMode=", locationMode, "notebook=", notebook, "processedMemos=", processedMemos.length);
      // 统一排序，无论写入daily note还是指定文档
      processedMemos.sort((a, b) => {
        return memosSort === "asc" ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt;
      });
      if (locationMode === "0") {
        if (!notebook) {
          notebook = this.siyuanStorage["local-dailynoteid"];
        }
        // 按更新时间分组
        const groupedMemos = {};
        processedMemos.forEach(memo => {
          const date = memo.updatedDate;
          if (!groupedMemos[date]) {
            groupedMemos[date] = [];
          }
          groupedMemos[date].push(memo);
        });
        console.log("[FlomoSync] 分组后的memos:", groupedMemos);
        // 依次遍历每个 Memo，写入对应日期页面
        const pageIdCache = {};
        for (const date in groupedMemos) {
          for (const memo of groupedMemos[date]) {
            let pageId = pageIdCache[date];
            if (!pageId) {
              pageId = await this.getDailyNotePageId(notebook, date);
              pageIdCache[date] = pageId;
            }
            console.log(`[FlomoSync] 写入页面ID: ${pageId}, 日期: ${date}`);
            let url = "/api/block/appendBlock";
            let data = {
              "data": memo.content,
              "dataType": "markdown",
              "parentID": pageId
            };
            console.log("[FlomoSync] 写入内容:", data);
            let rs = await fetchSyncPost(url, data);
            console.log("[FlomoSync] 写入结果:", rs);
            if (rs.code != 0) {
              console.log("❌ plugin-flomo-sync:" + rs.msg);
            }
          }
        }
        // 打开最后一个处理的页面
        if (processedMemos.length > 0) {
          const lastDate = processedMemos[processedMemos.length - 1].updatedDate;
          const lastPageId = pageIdCache[lastDate] || await this.getDailyNotePageId(notebook, lastDate);
          if (this.isMobile) {
            openMobileFileById(this.app, lastPageId);
          } else {
            openTab({ app: this.app, doc: { id: lastPageId } });
          }
        }
      } else {
        // 指定文档模式：保存到指定文档
        let targetPage = this.data[STORAGE_NAME].pageId;
        for (let memo of processedMemos) {
          let url = "/api/block/appendBlock";
          let data = {
            "data": memo.content,
            "dataType": "markdown",
            "parentID": targetPage
          };
          console.log("[FlomoSync] 写入指定文档内容:", data);
          let rs = await fetchSyncPost(url, data);
          console.log("[FlomoSync] 写入指定文档结果:", rs);
          if (rs.code != 0) {
            console.log("plugin-flomo-sync:" + rs.msg);
          }
        }
        if (this.isMobile) {
          openMobileFileById(this.app, targetPage);
        } else {
          openTab({ app: this.app, doc: { id: targetPage } });
        }
      }
    } catch (error) {
      console.error("plugin-flomo-sync:" + error);
      return false;
    }
    return true;
  }

  /**
   * 获取指定日期的Daily Note页面ID
   * @param notebook 笔记本id
   * @param date 日期字符串 YYYY-MM-DD
   * @returns 
   */
  async getDailyNotePageId(notebook, date) {
    try {
      console.log('[FlomoSync] getDailyNotePageId: notebook=', notebook, 'date=', date);
      // 1. 获取 daily note 配置
      let notebookConfResponse = await fetchSyncPost("/api/notebook/getNotebookConf", { notebook });
      console.log('[FlomoSync] getNotebookConf:', notebookConfResponse);
      if (notebookConfResponse.code !== 0 || !notebookConfResponse.data) {
        throw new Error('获取笔记本配置失败');
      }
      let dailyNoteSavePath = notebookConfResponse.data.conf.dailyNoteSavePath;
      console.log('[FlomoSync] dailyNoteSavePath:', dailyNoteSavePath);
      if (!dailyNoteSavePath) {
        throw new Error('未配置 dailyNoteSavePath');
      }
      // 2. 渲染路径
      let sprig = `toDate \"2006-01-02\" \"${date}\"`;
      let finalPath = dailyNoteSavePath.replace(/now/g, sprig);
      console.log('[FlomoSync] finalPath for renderSprig:', finalPath);
      let renderResponse = await fetchSyncPost("/api/template/renderSprig", { template: finalPath });
      console.log('[FlomoSync] renderSprig:', renderResponse);
      if (renderResponse.code !== 0) {
        throw new Error('renderSprig 渲染失败');
      }
      let renderedPath = renderResponse.data;
      console.log('[FlomoSync] renderedPath:', renderedPath);
      // 3. 先用 getIDsByHPath 查找页面ID，避免重复新建
      let ids = [];
      try {
        const idsResponse = await fetchSyncPost("/api/filetree/getIDsByHPath", { notebook, path: renderedPath });
        ids = idsResponse.data;
        console.log('[FlomoSync] getIDsByHPath:', idsResponse);
      } catch (err) {
        console.error('[FlomoSync] getIDsByHPath 调用异常：', err);
      }
      if (ids && ids.length > 0) {
        console.log('[FlomoSync] getIDsByHPath 命中页面ID:', ids[0]);
        return ids[0];
      }
      // 4. 查不到再新建页面
      let createResponse;
      try {
        createResponse = await fetchSyncPost("/api/filetree/createDocWithMd", {
          notebook: notebook,
          path: renderedPath,
          markdown: ''
        });
        console.log('[FlomoSync] createDocWithMd 返回:', createResponse);
        if (createResponse.code === 0 && createResponse.data) {
          let pageId = typeof createResponse.data === 'string' ? createResponse.data : createResponse.data.id;
          console.log('[FlomoSync] createDocWithMd 返回页面ID:', pageId);
          return pageId;
        } else {
          console.warn('[FlomoSync] createDocWithMd 创建失败，返回：', createResponse);
        }
      } catch (err) {
        console.error('[FlomoSync] createDocWithMd 调用异常：', err);
      }
      // 5. fallback: createDailyNote
      let fallbackResponse;
      try {
        fallbackResponse = await fetchSyncPost("/api/filetree/createDailyNote", { notebook, date });
        console.log('[FlomoSync] createDailyNote 返回:', fallbackResponse);
        if (fallbackResponse.code === 0 && fallbackResponse.data && fallbackResponse.data.id) {
          console.log('[FlomoSync] createDailyNote 返回页面ID:', fallbackResponse.data.id);
          return fallbackResponse.data.id;
        } else {
          console.warn('[FlomoSync] createDailyNote 创建失败，返回：', fallbackResponse);
        }
      } catch (err) {
        console.error('[FlomoSync] createDailyNote 调用异常：', err);
      }
      // 6. fallback: 今日ID
      let todayId = await this.getTodayId(notebook);
      console.log('[FlomoSync] fallback getTodayId:', todayId);
      return todayId;
    } catch (error) {
      let todayId = await this.getTodayId(notebook);
      console.log('[FlomoSync] error fallback getTodayId:', todayId);
      return todayId;
    }
  }

  /**
   * 获取今日id
   * @param notebook 笔记本id
   * @returns 
   */
  async getTodayId(notebook) {
    let response = await fetchSyncPost("/api/filetree/createDailyNote", { notebook: notebook })
    return response["data"]["id"];
  }
}