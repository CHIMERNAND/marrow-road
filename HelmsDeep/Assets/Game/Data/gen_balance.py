# Source of truth for balance.json (M2). Run: python3 gen_balance.py -> balance.json
# Edit numbers here (or balance.json directly; this script just keeps the waves readable).
import json
enemies=[
 dict(id="shambler",name="Shambler",kind="shambler",hp=100,speedMin=1.3,speedMax=2.0,scale=1.0,gateDps=2.0,gold=8),
 dict(id="runner",name="Runner",kind="runner",hp=55,speedMin=3.6,speedMax=4.4,scale=0.95,gateDps=1.5,gold=10),
 dict(id="brute",name="Armored brute",kind="brute",hp=420,speedMin=1.0,speedMax=1.3,scale=1.32,gateDps=5.0,armor=0.35,gold=30),
 dict(id="climber",name="Climber",kind="climber",hp=70,speedMin=2.2,speedMax=2.8,scale=0.95,gateDps=2.0,gold=12,
      meleeDamage=14,meleeInterval=1.3,climbSpeed=1.5),
 dict(id="ram",name="Ram crew",kind="ram",hp=900,speedMin=1.0,speedMax=1.2,scale=1.0,gateDps=0,armor=0.5,gold=60,
      ramDamage=45,ramInterval=2.4),
]
def T(cost,**k): return dict(cost=cost,**k)
turrets=[
 dict(id="crossbow",name="Wall crossbow",blurb="Fast single-target bolts",tiers=[
   T(150,damage=70,interval=1.6,range=90,projectileSpeed=85),
   T(125,damage=85,interval=1.25,range=100,projectileSpeed=90),
   T(175,damage=100,interval=0.95,range=110,projectileSpeed=95)]),
 dict(id="ballista",name="Ballista",blurb="Heavy bolt, pierces armor and lines of dead",tiers=[
   T(250,damage=200,interval=3.6,range=130,pierce=2,projectileSpeed=110),
   T(200,damage=260,interval=3.1,range=140,pierce=3,projectileSpeed=115),
   T(250,damage=320,interval=2.6,range=150,pierce=4,projectileSpeed=120)]),
 dict(id="catapult",name="Catapult",blurb="Long-range splash into the horde",tiers=[
   T(300,damage=130,interval=6.5,range=210,minRange=40,splash=6),
   T(225,damage=160,interval=5.5,range=220,minRange=40,splash=7),
   T(300,damage=200,interval=4.6,range=230,minRange=40,splash=8)]),
 dict(id="pitch",name="Boiling pitch",blurb="Burns everything at the gate",tiers=[
   T(200,damage=35,interval=7.0,duration=3.0),
   T(150,damage=50,interval=6.0,duration=3.5),
   T(200,damage=70,interval=5.0,duration=4.0)]),
]
def W(interval,**groups): return dict(spawnInterval=interval,groups=[dict(type=k,count=v) for k,v in groups.items() if v])
waves=[
 W(1.00,shambler=16),
 W(0.95,shambler=20,runner=4),
 W(0.90,shambler=22,runner=8,climber=2),
 W(0.85,shambler=24,runner=8,brute=2,climber=4),
 W(0.80,shambler=26,runner=10,brute=3,climber=4,ram=1),
 W(0.75,shambler=30,runner=12,brute=4,climber=6,ram=1),
 W(0.70,shambler=32,runner=14,brute=5,climber=6,ram=2),
 W(0.65,shambler=36,runner=16,brute=6,climber=8,ram=2),
 W(0.60,shambler=40,runner=18,brute=7,climber=8,ram=3),
 W(0.55,shambler=46,runner=22,brute=9,climber=10,ram=4),
]
balance=dict(version=1,
  gate=dict(hp=2500,slots=10), keep=dict(hp=1500,slots=8),
  economy=dict(startGold=250,headshotBonus=5,waveClearBase=40,waveClearPerWave=10,ladderShoveGold=0,repairCost=75,repairAmount=300),
  player=dict(hp=100,respawnSeconds=8,regenDelay=5,regenPerSecond=8),
  prep=dict(first=40,between=25), maxAlive=90,
  enemies=enemies,turrets=turrets,waves=waves)
json.dump(balance,open("balance.json","w"),indent=1)
print(len(waves),"waves",sum(sum(g["count"] for g in w["groups"]) for w in waves),"enemies")
