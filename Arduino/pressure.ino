#include <Adafruit_NeoPixel.h>

// ===== 压力传感器 =====
const int sensorPin1 = A0;
const int sensorPin2 = A1;
const int sensorPin3 = A2;

// ===== WS2812B =====
#define LED_PIN 6
#define NUM_LEDS 120

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

// 当前亮度
int currentBrightness = 0;

// 目标亮度
int targetBrightness = 0;

void setup() {
  Serial.begin(9600);

  strip.begin();
  strip.show();
  strip.setBrightness(0);
}

void loop() {

  // ===== 读取三个压力传感器 =====
  int val1 = analogRead(sensorPin1);
  int val2 = analogRead(sensorPin2);
  int val3 = analogRead(sensorPin3);

  // 输出传感器数据
  Serial.print(val1);
  Serial.print(",");
  Serial.print(val2);
  Serial.print(",");
  Serial.println(val3);

  // ===== 判断有几个传感器受到压力 =====
  int activeSensors = 0;

  if (val1 > 100) {
    activeSensors++;
  }

  if (val2 > 100) {
    activeSensors++;
  }

  if (val3 > 100) {
    activeSensors++;
  }

  // ===== 根据触发数量设置目标亮度 =====
  if (activeSensors == 0) {
    targetBrightness = 0;
  }
  else if (activeSensors == 1) {
    targetBrightness = 30;
  }
  else if (activeSensors == 2) {
    targetBrightness = 70;
  }
  else if (activeSensors == 3) {
    targetBrightness = 120;
  }

  // ===== 平滑改变亮度 =====
  if (currentBrightness < targetBrightness) {
    currentBrightness++;
  }
  else if (currentBrightness > targetBrightness) {
    currentBrightness--;
  }

  strip.setBrightness(currentBrightness);

  // 白光
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(255, 255, 255));
  }

  strip.show();

  delay(10);
}