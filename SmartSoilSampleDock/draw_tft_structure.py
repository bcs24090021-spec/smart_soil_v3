"""Clear schematic of the provisional enclosure, not a fabrication drawing."""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, Polygon
from matplotlib.font_manager import FontProperties

OUT = Path(__file__).resolve().parent / 'output' / 'tft-concept'
FONT = FontProperties(fname='/System/Library/Fonts/Hiragino Sans GB.ttc')
plt.rcParams['svg.fonttype'] = 'path'
fig = plt.figure(figsize=(16, 11), facecolor='white')
ink, shell, wet, dry = '#223238', '#bcc9cd', '#d9edf0', '#ecf1f3'

def text(ax, x, y, s, size=12, **kwargs):
    ax.text(x, y, s, fontproperties=FONT, fontsize=size, color=ink, **kwargs)

def rect(ax, x, y, w, h, color, dashed=False):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=color, edgecolor=ink,
                           linewidth=1.5, linestyle='--' if dashed else '-'))

def label(ax, target, position, s):
    ax.annotate(s, xy=target, xytext=position, fontproperties=FONT,
                fontsize=11, color=ink, va='center',
                arrowprops=dict(arrowstyle='-', color=ink, lw=1.2))

def panel(bounds, title, limits):
    ax = fig.add_axes(bounds)
    ax.set_xlim(*limits[0]); ax.set_ylim(*limits[1])
    ax.set_aspect('equal'); ax.axis('off')
    text(ax, limits[0][0], limits[1][1]-5, title, 17, va='top')
    return ax

fig.text(.045, .95, 'Smart Soil｜一体式土样检测装置：结构概念图',
         fontproperties=FONT, fontsize=24, color=ink)
fig.text(.045, .912, '实线：已有外壳结构    虚线：拟放置的硬件 / 待设计安装结构    图中硬件位置为示意',
         fontproperties=FONT, fontsize=12, color=ink)

ax = panel([.04,.32,.43,.55], '01  俯视图（上方开放，不加盖）', ((-130,150),(-130,125)))
rect(ax,-75,-90,150,180,shell)
rect(ax,-70,-85,140,75,dry)
ax.add_patch(Circle((0,43),42,facecolor=wet,edgecolor=ink,lw=1.5))
text(ax,0,31,'土样槽\n内径 84 mm',12,ha='center',va='center')
rect(ax,-54,62,108,12,'#8b9da2')
rect(ax,-38.5,66,25,4,'#529675')
for x,r,c in [(4,3.5,'#eeeeee'),(27,6.5,'#5bbdc2')]:
    ax.add_patch(Circle((x,68),r,facecolor=c,edgecolor=ink))
rect(ax,-26,-68,52,40,'#b9e1e8')
text(ax,0,-48,'TFT 屏幕',12,ha='center',va='center')
rect(ax,-64,-80,25,40,'none',True)
text(ax,-51.5,-60,'ESP32\n下方',9,ha='center',va='center')
rect(ax,36,-79,28,36,'none',True)
text(ax,50,-61,'pH 板\n下方',9,ha='center',va='center')
label(ax,(-26,68),(-126,103),'电容式湿度探头导槽')
label(ax,(4,68),(38,108),'DS18B20 导孔')
label(ax,(27,68),(82,85),'pH 探头导孔')
label(ax,(0,-5),(82,3),'实体湿 / 干隔离区')
label(ax,(74,-57),(83,-58),'USB 开口')
text(ax,0,-103,'机身宽 150 mm × 长 180 mm',11,ha='center')
text(ax,-126,-121,'前方：倾斜屏幕 / 干燥电子仓',11)

ax = panel([.50,.49,.46,.38], '02  侧面剖视（探头投影示意）', ((-118,115),(-34,150)))
ax.add_patch(Polygon([(-90,0),(-90,32),(-5,68),(90,68),(90,0)],
                     facecolor=shell,edgecolor=ink,lw=1.5))
ax.add_patch(Polygon([(-85,0),(-85,26),(-10,62),(-10,0)],
                     facecolor='white',edgecolor=ink,lw=1.2))
rect(ax,1,6,84,62,wet)
rect(ax,1,6,84,27,'#aa9679')
text(ax,43,19,'土样 / 加水后悬液',10,ha='center')
rect(ax,62,68,12,21,shell)
rect(ax,62,89,12,6,'#8b9da2')
rect(ax,42,31,3,76,'none',True)
rect(ax,57,31,3,70,'none',True)
rect(ax,70,28,5,102,'none',True)
label(ax,(72,119),(-111,120),'探头插入深度待实测调整')
label(ax,(65,92),(-111,100),'后方探头支架')
ax.plot([-66,-32],[44,58],color='#3099aa',lw=6)
label(ax,(-48,51),(-111,76),'倾斜 TFT')
rect(ax,-76,9,43,11,'none',True)
text(ax,-54.5,14,'电子仓',10,ha='center',va='center')
rect(ax,-82,-12,74,3,dry)
label(ax,(-42,-11),(-112,-25),'底部检修板（尚无固定扣 / 螺丝）')
label(ax,(43,6),(10,-25),'槽底厚度约 6 mm')
text(ax,-111,43,'机身 + 支架高 95 mm\n（不含探头）',9,va='top')

ax = panel([.51,.22,.44,.25], '03  组装关系', ((0,225),(0,132)))
rect(ax,0,78,96,27,'#e4f0ee',True)
text(ax,48,91,'探头 + TFT + 电子板\n购买的硬件，不是打印件',11,ha='center',va='center')
rect(ax,122,78,101,27,shell)
text(ax,172.5,91,'一体打印主机身\n土样槽 + 电子仓 + 支架',11,ha='center',va='center')
ax.annotate('',xy=(121,91),xytext=(97,91),arrowprops=dict(arrowstyle='->',color=ink))
rect(ax,122,33,101,22,dry)
text(ax,172.5,44,'独立底部检修板',11,ha='center',va='center')
ax.annotate('',xy=(172,58),xytext=(172,75),arrowprops=dict(arrowstyle='<->',color=ink))
text(ax,0,48,'待完善：\n屏幕 / 电路板固定柱\n探头可拆夹具、密封走线孔\nDHT22 外部通风安装位',11,va='top')

fig.text(.045,.15,'使用顺序：放土 → 先测相对湿度 / 温度 → 加定量水、搅拌 → 测 pH（需要校准）',
         fontproperties=FONT,fontsize=13,color=ink)
fig.text(.045,.11,'DHT22 测空气温湿度，必须留在干燥通风处；pH 玻璃电极不要硬插干土，取出后按说明保存。',
         fontproperties=FONT,fontsize=12,color=ink)
fig.text(.045,.067,'这是当前模型的结构说明，不是最终加工图。屏幕、探头尺寸未核实；打印槽未验证防漏，建议使用独立防水内杯。',
         fontproperties=FONT,fontsize=11,color='#58666c')
OUT.mkdir(parents=True,exist_ok=True)
fig.savefig(OUT/'TFT_station_structure_ZH.png',dpi=180)
fig.savefig(OUT/'TFT_station_structure_ZH.svg')
print(OUT/'TFT_station_structure_ZH.png')
