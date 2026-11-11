# Source of truth for the graybox layout. Run: python3 gen_layout.py  -> graybox_layout.json
# Units: metres. Enemy valley is -Z. Wall face at z=0. Up is +Y.
import json
boxes=[]
def box(name,kind,c,s,r=(0,0,0),walk=False,collide=True):
    boxes.append(dict(name=name,kind=kind,p=list(c),s=list(s),r=list(r),walkable=walk,collide=collide))
def slab(name,kind,x0,x1,y0,y1,z0,z1,**k):
    box(name,kind,((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),(x1-x0,y1-y0,z1-z0),**k)

WALL_TOP=15.0   # lowered from 20 m so the horde reads at the wall base and climbs are shorter
COURT_Y=6.0     # Hornburg shelf / court / gate threshold height
GATE_H=7.0
# Ground
slab("ValleyFloor","ground",-320,420,-1,0,-420,0,walk=True)
slab("DeepFloor","ground",-320,420,-1,0,6,220)
# Flanking mountains
slab("WestCliff","rock",-260,-120,0,62,-80,140)
slab("EastMountain","rock",175,330,0,72,-60,160)
slab("EastMountainFoot","rock",175,240,0,30,-110,-60)
# Deeping Wall (x -120..120), 6 m thick, walk on top
slab("DeepingWall","wall",-120,120,0,WALL_TOP,0,6)
# Bastions protruding toward the valley (turret sockets on top)
for i,x in enumerate((-70,0,70)):
    slab(f"Bastion_{i}","tower",x-6,x+6,0,WALL_TOP,-7,0)
# Culvert recess at the base (M2 breach point, visual only now)
slab("CulvertRecess","dark",-4,4,0,3.2,-0.05,0.6,collide=False)
# Hornburg rock shelf in front of the keep (gate threshold at y=COURT_Y)
slab("HornburgShelf","rock",120,175,0,COURT_Y,-16,0,walk=True)
# Hornburg front wall, split around the gate opening x 136..144, y COURT_Y..COURT_Y+GATE_H
slab("HornburgWall_W","wall",120,136,0,WALL_TOP,0,6)
slab("HornburgWall_E","wall",144,175,0,WALL_TOP,0,6)
slab("HornburgWall_Lintel","wall",136,144,COURT_Y+GATE_H,WALL_TOP,0,6)
slab("HornburgWall_Sill","wall",136,144,0,COURT_Y,0,6)
# Gatehouse towers flanking the gate
slab("GateTower_W","tower",128,136,0,WALL_TOP,-4,8,walk=True)
slab("GateTower_E","tower",144,152,0,WALL_TOP,-4,8,walk=True)
# Courtyard platform behind the gate and the keep
slab("HornburgCourt","rock",120,175,0,COURT_Y,6,60)
slab("Keep","tower",150,172,COURT_Y,COURT_Y+38,22,44)
slab("KeepTower","tower",156,166,COURT_Y+38,COURT_Y+48,28,38)
# Causeway: 60 m ramp from valley floor up to the shelf front (z=-16, y=COURT_Y), 8 m wide
import math
L=math.hypot(60,COURT_Y); ang=math.degrees(math.atan2(COURT_Y,60))
box("Causeway","road",(140,COURT_Y/2-0.6,-16-30),(8,1.2,L),r=(-ang,0,0),walk=True)
# Causeway retaining walls (low parapets)
for side,x in (("W",135.6),("E",144.4)):
    box(f"CausewayRail_{side}","wall",(x,COURT_Y/2+0.4,-16-30),(0.8,1.4,L),r=(-ang,0,0))
# Causeway fill under the ramp so it reads as solid masonry
for i in range(6):
    z0=-76+i*10; z1=z0+10; h=(i+0.5)*COURT_Y/6
    slab(f"CausewayFill_{i}","wall",136,144,0,max(0.2,h-1.2),z0,z1)

MERLON_W,MERLON_GAP=1.0,2.4   # wide crenels, low merlons: the parapet frames the valley instead of hiding it
def crenel(x0,x1,near):
    """Centre x of the merlon gap closest to `near` (mirrors GrayboxBuilder.MakeParapet)."""
    L=x1-x0; pitch=MERLON_W+MERLON_GAP; n=int((L+MERLON_GAP)/pitch+0.001)
    used=n*MERLON_W+(n-1)*MERLON_GAP; start=x0+(L-used)/2+MERLON_W/2
    gaps=[start+i*pitch+pitch/2 for i in range(n-1)]
    return round(min(gaps,key=lambda g:abs(g-near)),3)

parapets=[ # breastwork + merlons on the valley side of each wall-walk run (axis x unless noted)
  dict(name="Parapet_Deeping_0",x0=-120,x1=-76,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_Deeping_1",x0=-64,x1=-6,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_Deeping_2a",x0=6,x1=26,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_Deeping_2b",x0=30,x1=64,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_Deeping_3a",x0=76,x1=98,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_Deeping_3b",x0=102,x1=120,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_HornW",x0=120,x1=128,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_GateTowerW",x0=128,x1=136,z=-3.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_OverGate",x0=136,x1=144,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_GateTowerE",x0=144,x1=152,z=-3.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_HornE_a",x0=152,x1=156,z=0.5,y=WALL_TOP,thick=1.0),
  dict(name="Parapet_HornE_b",x0=160,x1=175,z=0.5,y=WALL_TOP,thick=1.0),
]
for i,x in enumerate((-70,0,70)):
    parapets.append(dict(name=f"Parapet_Bastion_{i}",x0=x-6,x1=x+6,z=-6.5,y=WALL_TOP,thick=1.0))
    parapets.append(dict(name=f"Parapet_BastionW_{i}",x0=x-5.5,x1=x-5.5,z0=-7,z1=0,y=WALL_TOP,thick=1.0,axis="z"))
    parapets.append(dict(name=f"Parapet_BastionE_{i}",x0=x+5.5,x1=x+5.5,z0=-7,z1=0,y=WALL_TOP,thick=1.0,axis="z"))

# Archer hoardings: timber balconies cantilevered out over the wall face where the parapet is cut away.
# Waist-high rail only, so a standing defender sees (and shoots) straight down the wall at ladders and the gate.
HOARDINGS=[("Hoarding_West",28.0),("Hoarding_East",100.0),("Hoarding_Gate",158.0)]
HW,HD=4.0,2.4
for name,x in HOARDINGS:
    slab(name+"_Deck","wood",x-HW/2,x+HW/2,WALL_TOP-0.25,WALL_TOP,-HD,1.0,walk=True)
    slab(name+"_RailFront","wood",x-HW/2,x+HW/2,WALL_TOP+0.95,WALL_TOP+1.1,-HD,-HD+0.12)
    slab(name+"_KickFront","wood",x-HW/2,x+HW/2,WALL_TOP,WALL_TOP+0.2,-HD,-HD+0.1)
    for sx in (-1,1):
        xe=x+sx*(HW/2-0.06)
        slab(name+f"_RailSide{sx:+d}","wood",xe-0.06,xe+0.06,WALL_TOP+0.95,WALL_TOP+1.1,-HD,0.0)
        slab(name+f"_KickSide{sx:+d}","wood",xe-0.05,xe+0.05,WALL_TOP,WALL_TOP+0.2,-HD,0.0)
    for k,px in enumerate((x-HW/2+0.08,x-0.65,x+0.65,x+HW/2-0.08)):
        slab(name+f"_Post{k}","wood",px-0.07,px+0.07,WALL_TOP,WALL_TOP+1.1,-HD+0.02,-HD+0.16)
    # Corbel braces under the deck (visual)
    for k,px in enumerate((x-1.5,x,x+1.5)):
        box(name+f"_Brace{k}","wood",(px,WALL_TOP-1.2,-HD/2+0.1),(0.18,0.2,2.9),r=(-38,0,0),collide=False)
rails=[ # low inner rail so the player can't walk off the back of the wall
  dict(name="InnerRail_Deeping",x0=-120,x1=175,z=5.7,y=WALL_TOP,thick=0.6,height=1.0),
  # Murder galleries: low rails on the tower edges over the gate recess so defenders can shoot straight down.
  dict(name="GateGallery_W",axis="z",x0=135.8,x1=135.8,z0=-4,z1=0,y=WALL_TOP,thick=0.4,height=0.55),
  dict(name="GateGallery_E",axis="z",x0=144.2,x1=144.2,z0=-4,z1=0,y=WALL_TOP,thick=0.4,height=0.55),
]
layout=dict(
  wallTop=WALL_TOP,
  boxes=boxes, parapets=parapets, rails=rails,
  playerSpawn=dict(p=[crenel(102,120,112),WALL_TOP+0.05,1.38],yaw=172.0),
  gateCenter=[140,COURT_Y+GATE_H/2,0.0],
  gateTarget=[140,COURT_Y,-2.0],
  spawnMin=[100,0,-140], spawnMax=[190,0,-108],
  sockets=[
    dict(name="Socket_Bastion1",p=[0,WALL_TOP,-3.5],allow=["crossbow","ballista","catapult"]),
    dict(name="Socket_Bastion2",p=[70,WALL_TOP,-3.5],allow=["crossbow","ballista","catapult"]),
    dict(name="Socket_WallEast",p=[110,WALL_TOP,2.6],allow=["crossbow","ballista"]),
    dict(name="Socket_GateTowerW",p=[131.5,WALL_TOP,-1.2],allow=["crossbow","ballista","catapult"]),
    dict(name="Socket_GateTowerE",p=[148.5,WALL_TOP,-1.2],allow=["crossbow","ballista","catapult"]),
    dict(name="Socket_OverGate",p=[140,WALL_TOP,2.0],allow=["pitch"]),
  ],
  # Ladder zones: climbers raise a siege ladder against the wall face at a crenel and come over the top.
  ladders=[dict(name="Ladder_East",x=crenel(76,98,92),baseZ=-6.5,topY=WALL_TOP+1.0),
           dict(name="Ladder_West",x=crenel(30,64,41),baseZ=-6.5,topY=WALL_TOP+1.0)],
  # Fall-back point: when the gate breaks the dead push across the court to the keep door.
  keepTarget=[161,COURT_Y,20.0],
  keepDoor=[161,COURT_Y,21.7],
  dummies=[dict(name="ScaleDummy_WallBase",p=[92,0,-3]), dict(name="ScaleDummy_Causeway",p=[140,COURT_Y/2,-46]),
           dict(name="ScaleDummy_WallWalk",p=[92,WALL_TOP,3.0])],
  torchList=[dict(p=[x,WALL_TOP+2.2,1.2]) for x in range(-110,121,20)] + [dict(p=[133,WALL_TOP-2,-4.6]),dict(p=[147,WALL_TOP-2,-4.6])],
)
json.dump(layout,open("graybox_layout.json","w"),indent=1)
print(len(boxes),"boxes")
