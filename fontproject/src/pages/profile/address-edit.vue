<template>
  <view class="page">
    <view class="hero-bg">
      <view class="blur-dot dot-left" />
    </view>

    <view class="content">
      <view class="form-card">
        <view class="field">
          <text class="label">收货人</text>
          <input
            v-model.trim="form.consignee"
            class="input"
            type="text"
            placeholder="请填写姓名"
            placeholder-class="ph"
            maxlength="64"
          />
        </view>
        <u-line margin="0" color="#f1f5f9" />
        <view class="field">
          <text class="label">手机号</text>
          <input
            v-model.trim="form.phone"
            class="input"
            type="number"
            placeholder="11 位手机号码"
            placeholder-class="ph"
            maxlength="20"
          />
        </view>
        <u-line margin="0" color="#f1f5f9" />
        <!-- 微信小程序原生省市区选择器：mode=region，与微信内置地区数据一致 -->
        <picker mode="region" :value="regionPickerValue" @change="onRegionChange">
          <view class="field region-row">
            <text class="label">省市区</text>
            <view class="picker-trigger">
              <text class="picker-text" :class="{ 'picker-text--placeholder': !regionDisplayText }">
                {{ regionDisplayText || "请选择省、市、区" }}
              </text>
              <u-icon name="arrow-right" :size="14" color="#94a3b8" />
            </view>
          </view>
        </picker>
        <u-line margin="0" color="#f1f5f9" />
        <view class="field field-column">
          <text class="label">详细地址</text>
          <textarea
            v-model.trim="form.detail"
            class="textarea"
            placeholder="街道、楼牌号等"
            placeholder-class="ph"
            maxlength="255"
            auto-height
          />
        </view>
        <u-line margin="0" color="#f1f5f9" />
        <view class="field switch-row">
          <view class="switch-label-wrap">
            <text class="label">默认地址</text>
            <text class="switch-hint">下单时优先使用该地址</text>
          </view>
          <u-switch v-model="form.isDefault" active-color="#2563eb" inactive-color="#e2e8f0" />
        </view>
      </view>

      <u-button
        type="primary"
        shape="circle"
        :text="isEdit ? '保存修改' : '保存地址'"
        :loading="submitting"
        :custom-style="saveBtnStyle"
        @click="onSubmit"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import {
  createUserAddressApi,
  getUserAddressDetailApi,
  updateUserAddressApi,
} from "@/api/userAddress";

const saveBtnStyle =
  "width: 100%; height: 88rpx; margin-top: 36rpx; font-size: 30rpx; font-weight: 600; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none;";

const editId = ref<number | null>(null);
const isEdit = ref(false);
const submitting = ref(false);

const form = reactive({
  consignee: "",
  phone: "",
  /** 省市区展示与提交用文案（与 picker 选择结果同步，空格连接） */
  region: "",
  detail: "",
  isDefault: false,
});

/**
 * 微信 region 选择器绑定的省市区名称数组，长度应为 3；空数组表示未选，由组件默认展示第一列首项（仅展示层）。
 */
const regionPickerValue = ref<string[]>([]);

/**
 * 选择器右侧展示文案。
 */
const regionDisplayText = computed(() => {
  const arr = regionPickerValue.value;
  if (arr.length === 3 && arr[0] && arr[1] && arr[2]) {
    return arr.join(" ");
  }
  return "";
});

/**
 * 将已保存的 region 字符串尽量还原为 picker 的 value（按空白拆成省、市、区）。
 * 历史手填且无法拆成三段时返回空数组，需用户重新选择。
 */
const parseRegionToPickerValue = (s: string): string[] => {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return [parts[0]!, parts[1]!, parts[2]!];
  }
  return [];
};

/**
 * region 选择变更：写入 picker 数组并同步到 form.region 供提交。
 */
const onRegionChange = (e: { detail: { value: string[] } }) => {
  const v = e.detail?.value;
  if (!Array.isArray(v) || v.length < 3) return;
  regionPickerValue.value = [v[0] || "", v[1] || "", v[2] || ""];
  form.region = regionPickerValue.value.filter(Boolean).join(" ");
};

/**
 * 简单校验中国大陆常见 11 位手机号（1 开头第二位 3–9）。
 */
const isPhoneOk = (p: string) => /^1[3-9]\d{9}$/.test(p);

/**
 * 拉取详情并填充表单（编辑模式）。
 */
const loadDetail = async (id: number) => {
  try {
    const res = await getUserAddressDetailApi(id);
    if (res.code !== 0 || !res.data) {
      uni.showToast({ title: res.message || "加载失败", icon: "none" });
      return;
    }
    const d = res.data;
    form.consignee = d.consignee;
    form.phone = d.phone;
    const savedRegion = d.region || "";
    regionPickerValue.value = parseRegionToPickerValue(savedRegion);
    form.region =
      regionPickerValue.value.length === 3 ? regionPickerValue.value.join(" ") : "";
    form.detail = d.detail;
    form.isDefault = d.isDefault;
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
  }
};

const onSubmit = async () => {
  if (!uni.getStorageSync("token")) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  if (!form.consignee) {
    uni.showToast({ title: "请填写收货人", icon: "none" });
    return;
  }
  if (!isPhoneOk(form.phone)) {
    uni.showToast({ title: "请填写正确手机号", icon: "none" });
    return;
  }
  if (!form.detail) {
    uni.showToast({ title: "请填写详细地址", icon: "none" });
    return;
  }
  if (
    regionPickerValue.value.length < 3 ||
    !regionPickerValue.value[0] ||
    !regionPickerValue.value[1] ||
    !regionPickerValue.value[2]
  ) {
    uni.showToast({ title: "请选择省市区", icon: "none" });
    return;
  }
  form.region = regionPickerValue.value.join(" ");
  if (form.region.length > 128) {
    uni.showToast({ title: "省市区过长", icon: "none" });
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      consignee: form.consignee,
      phone: form.phone,
      region: form.region,
      detail: form.detail,
      isDefault: form.isDefault,
    };
    if (isEdit.value && editId.value != null) {
      const res = await updateUserAddressApi(editId.value, payload);
      if (res.code !== 0) {
        uni.showToast({ title: res.message || "保存失败", icon: "none" });
        return;
      }
    } else {
      const res = await createUserAddressApi(payload);
      if (res.code !== 0) {
        uni.showToast({ title: res.message || "保存失败", icon: "none" });
        return;
      }
    }
    uni.showToast({ title: "保存成功", icon: "success" });
    setTimeout(() => {
      uni.navigateBack();
    }, 400);
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
  } finally {
    submitting.value = false;
  }
};

onLoad((q) => {
  const raw = q?.id;
  if (raw != null && raw !== "") {
    const id = parseInt(String(raw), 10);
    if (Number.isFinite(id) && id > 0) {
      editId.value = id;
      isEdit.value = true;
      uni.setNavigationBarTitle({ title: "编辑地址" });
      void loadDetail(id);
      return;
    }
  }
  uni.setNavigationBarTitle({ title: "新增地址" });
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #dbeafe 0%, #f0f6ff 380rpx, #f8fafc 100%);
  position: relative;
}

.hero-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 160rpx;
  overflow: hidden;
  pointer-events: none;
}

.blur-dot {
  position: absolute;
  border-radius: 50%;
  filter: blur(2rpx);
}

.dot-left {
  width: 260rpx;
  height: 260rpx;
  left: -70rpx;
  top: -100rpx;
  background: radial-gradient(circle, rgba(66, 120, 255, 0.22) 0%, rgba(66, 120, 255, 0) 72%);
}

.content {
  padding: 24rpx 16rpx 48rpx;
  position: relative;
  z-index: 1;
}

.form-card {
  border-radius: 28rpx;
  background: #ffffff;
  padding: 8rpx 24rpx 12rpx;
  box-shadow: 0 12rpx 34rpx rgba(24, 42, 84, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.88);
}

.field {
  display: flex;
  align-items: center;
  min-height: 100rpx;
  padding: 16rpx 0;
}

.field-column {
  flex-direction: column;
  align-items: stretch;
}

.label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 28rpx;
  font-weight: 600;
  color: #334155;
}

.field-column .label {
  width: auto;
  margin-bottom: 12rpx;
}

.input {
  flex: 1;
  font-size: 28rpx;
  color: #0f172a;
  min-width: 0;
}

.region-row {
  justify-content: space-between;
}

.picker-trigger {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  min-width: 0;
}

.picker-text {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-text--placeholder {
  color: #94a3b8;
}

.textarea {
  width: 100%;
  min-height: 120rpx;
  font-size: 28rpx;
  line-height: 1.5;
  color: #0f172a;
}

.ph {
  color: #94a3b8;
}

.switch-row {
  justify-content: space-between;
  align-items: center;
}

.switch-label-wrap {
  flex: 1;
  min-width: 0;
}

.switch-hint {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #94a3b8;
}
</style>
