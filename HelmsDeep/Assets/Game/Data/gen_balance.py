# Source of truth for balance.json (M2). Run: python3 gen_balance.py -> balance.json
# Edit numbers here (or balance.json directly; this script just keeps the waves readable).
import json
enemies=[
 dict(id="shambler",name="Shambler",kind="shambler",hp=110,speedMin=1.4,speedMax=2.1,scale=1.0,gateDps=2.0,gold=4),
 dict(id="runner",name="Runner",kind="runner",hp=65,speedMin=3.6,speedMax=4.4,scale=0.95,gateDps=1.5,gold=5),
 dict(id="brute",name="Armored brute",kind="brute",hp=480,speedMin=1.0,speedMax=1.3,scale=1.32,gateDps=5.0,armor=0.35,gold=14),
 dict(id="climber",name="Climber",kind="climber",hp=80,speedMin=2.4,speedMax=3.0,scale=0.95,gateDps=2.0,gold=6,
      meleeDamage=14,meleeInterval=1.3,climbSpeed=1.5),
 dict(id="ram",name="Ram crew",kind="ram",hp=1000,speedMin=1.0,speedMax=1.2,scale=1.0,gateDps=0,armor=0.5,gold=30,
      ramDamage=45,ramInterval=2.4),
]
def T(cost,**k): return dict(cost=cost,**k)
turrets=[
 dict(id="crossbow",name="Wall crossbow",blurb="Fast single-target bolts",tiers=[
   T(150,damage=60,interval=1.8,range=90,projectileSpeed=85),
   T(125,damage=75,interval=1.45,range=100,projectileSpeed=90),
   T(175,damage=90,interval=1.15,range=110,projectileSpeed=95)]),
 dict(id="ballista",name="Ballista",blurb="Heavy bolt, pierces armor and lines of dead",tiers=[
   T(250,damage=200,interval=3.6,range=130,pierce=2,projectileSpeed=110),
   T(200,damage=260,interval=3.1,range=140,pierce=2,projectileSpeed=115),
   T(250,damage=320,interval=2.6,range=150,pierce=3,projectileSpeed=120)]),
 dict(id="catapult",name="Catapult",blurb="Long-range splash into the horde",tiers=[
   T(300,damage=90,interval=7.5,range=210,minRange=40,splash=4),
   T(225,damage=110,interval=6.5,range=220,minRange=40,splash=4.5),
   T(300,damage=135,interval=5.5,range=230,minRange=40,splash=5)]),
 dict(id="pitch",name="Boiling pitch",blurb="Burns everything at the gate",tiers=[
   T(200,damage=35,interval=7.0,duration=3.0),
   T(150,damage=50,interval=6.0,duration=3.5),
   T(200,damage=70,interval=5.0,duration=4.0)]),
]
def W(interval,hpMul,**groups): return dict(spawnInterval=interval,hpMul=hpMul,groups=[dict(type=k,count=v) for k,v in groups.items() if v])
# M2 tuning pass 2 (after the first full bot night: nothing reached the wall, gold piled up to 3.4k).
# Late waves carry more and tougher dead (hpMul), turrets hit softer, kill gold is roughly halved.
waves=[
 W(1.00,1.00,shambler=16),
 W(0.95,1.05,shambler=22,runner=5),
 W(0.90,1.10,shambler=26,runner=9,climber=3),
 W(0.85,1.16,shambler=30,runner=10,brute=2,climber=5),
 W(0.80,1.22,shambler=34,runner=12,brute=3,climber=6,ram=1),
 W(0.72,1.28,shambler=40,runner=15,brute=5,climber=8,ram=1),
 W(0.66,1.35,shambler=44,runner=18,brute=6,climber=8,ram=2),
 W(0.60,1.42,shambler=50,runner=20,brute=8,climber=10,ram=2),
 W(0.55,1.50,shambler=56,runner=24,brute=9,climber=11,ram=3),
 W(0.50,1.55,shambler=64,runner=28,brute=10,climber=14,ram=4),
]
balance=dict(version=1,
  gate=dict(hp=2500,slots=10), keep=dict(hp=1500,slots=8),
  economy=dict(startGold=250,headshotBonus=5,waveClearBase=50,waveClearPerWave=15,ladderShoveGold=0,repairCost=75,repairAmount=300),
  player=dict(hp=100,respawnSeconds=8,regenDelay=5,regenPerSecond=8),
  prep=dict(first=40,between=25), maxAlive=90,
  enemies=enemies,turrets=turrets,waves=waves)
json.dump(balance,open("balance.json","w"),indent=1)
gold={e["id"]:e["gold"] for e in enemies}
kg=sum(gold[g["type"]]*g["count"] for w in waves for g in w["groups"])
clear=sum(balance["economy"]["waveClearBase"]+balance["economy"]["waveClearPerWave"]*(i+1) for i in range(len(waves)))
print("kill gold",kg,"clear gold",clear,"start",balance["economy"]["startGold"],"full build-out",sum(sum(t["cost"] for t in td["tiers"]) for td in turrets))
print(len(waves),"waves",sum(sum(g["count"] for g in w["groups"]) for w in waves),"enemies")
