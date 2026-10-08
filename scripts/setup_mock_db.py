import sqlite3, csv, random, os, shutil
from datetime import date, timedelta

random.seed(144)
TODAY = date(2026, 10, 5)

BASE_DIR = os.path.abspath("./h9loop_support")
ORIG_DIR = f"{BASE_DIR}/data_original"
WORK_DIR = f"{BASE_DIR}/data_work"
TEST_DIR = f"{BASE_DIR}/testing"
BACKUP_DIR = f"{BASE_DIR}/backups"
DRAFT_DIR = f"{BASE_DIR}/drafts"
AUDIT_DIR = f"{BASE_DIR}/audit_trail"
SKILLS_DIR = f"{BASE_DIR}/skills"

for d in [ORIG_DIR, WORK_DIR, TEST_DIR, BACKUP_DIR, DRAFT_DIR, AUDIT_DIR, SKILLS_DIR]:
    os.makedirs(d, exist_ok=True)

db_path = f"{ORIG_DIR}/h9loop_clients.db"
if os.path.exists(db_path):
    os.remove(db_path)

db = sqlite3.connect(db_path)
c = db.cursor()
c.executescript("""
CREATE TABLE customers(customer_id TEXT PRIMARY KEY, full_name TEXT, email TEXT, phone TEXT, city TEXT, province TEXT,
 client_type TEXT, company TEXT, membership_status TEXT, account_status TEXT, fraud_flag INTEGER, popia_marketing_consent INTEGER,
 verification_phone_last4 TEXT, joined_date TEXT, open_cases INTEGER);
CREATE TABLE products(product_id TEXT PRIMARY KEY, name TEXT, category TEXT, price_zar REAL, is_digital INTEGER, is_subscription INTEGER, refundable INTEGER);
CREATE TABLE orders(order_number TEXT PRIMARY KEY, customer_id TEXT, product_id TEXT, order_date TEXT, amount_zar REAL,
 delivery_status TEXT, delivery_date TEXT, refund_window_ends TEXT, payment_method TEXT, refund_status TEXT, notes TEXT);
CREATE TABLE payments(transaction_id TEXT PRIMARY KEY, order_number TEXT, customer_id TEXT, amount_zar REAL, payment_date TEXT, status TEXT, method TEXT);
CREATE TABLE refunds(refund_id TEXT PRIMARY KEY, order_number TEXT, amount_zar REAL, created_date TEXT, status TEXT);
CREATE TABLE support_cases(case_number TEXT PRIMARY KEY, customer_id TEXT, opened_date TEXT, category TEXT, status TEXT, summary TEXT);
CREATE TABLE policies(policy_id TEXT PRIMARY KEY, topic TEXT, rule_text TEXT, threshold_zar REAL, escalate INTEGER);
""")

first = ["Thabo","Lerato","Sipho","Naledi","Ayesha","Pieter","Zanele","Kagiso","Priya","Johan","Nomsa","Tendai","Fatima","Riaan","Palesa","Mpho","Anele","Devon","Keshav","Busisiwe","Chantelle","Yusuf","Lindiwe","Ruan","Thandi","Sibusiso","Megan","Themba","Karabo","Ilse"]
last = ["Nkosi","Naidoo","van der Merwe","Dlamini","Patel","Botha","Mokoena","Khumalo","Pillay","Smit","Sithole","Moyo","Cassim","Pretorius","Molefe","Govender","Ndlovu","Jacobs","Maharaj","Zulu","Williams","Mahlangu","Chetty","du Plessis","Mthembu"]
cities = [("Johannesburg","Gauteng"),("Pretoria","Gauteng"),("Sandton","Gauteng"),("Cape Town","Western Cape"),("Stellenbosch","Western Cape"),("Durban","KwaZulu-Natal"),("Pietermaritzburg","KwaZulu-Natal"),("Gqeberha","Eastern Cape"),("Bloemfontein","Free State"),("Polokwane","Limpopo"),("Mbombela","Mpumalanga")]
biz = ["Bright Path Logistics","Karoo Craft Co","Umoja Retail","Lakeview Dental","Savanna Solar","Table Bay Tutors","Highveld Hardware","Ubuntu Foods","Delta Accounting","Kwela Print"]

products = [
 ("P001","AI Foundations Course","Course",2500,1,0,1),
 ("P002","Prompt Engineering Bootcamp","Course",4500,1,0,1),
 ("P003","AI Agents Masterclass","Course",6500,1,0,1),
 ("P004","Claude Skills Jar Subscription (monthly)","Subscription",299,1,1,1),
 ("P005","Placement Programme (real-project placement)","Programme",12000,0,0,1),
 ("P006","POPIA & AI Compliance Workshop (SMB)","Workshop",8500,0,0,1),
 ("P007","AI Implementation Starter Package (SMB)","Consulting",25000,0,0,1),
 ("P008","1:1 Coaching Session","Coaching",1200,0,0,1),
 ("P009","Downloadable Prompt Template Pack","Digital download",350,1,0,0),
]
c.executemany("INSERT INTO products VALUES(?,?,?,?,?,?,?)", products)
P = {p[0]:p for p in products}

cust=[]; used=set()
for i in range(1,101):
    while True:
        fn, ln = random.choice(first), random.choice(last)
        if (fn,ln) not in used: used.add((fn,ln)); break
    city, prov = random.choice(cities)
    ctype = random.choices(["Student","Entrepreneur","SMB"],[50,25,25])[0]
    company = random.choice(biz) if ctype=="SMB" else ("" if ctype=="Student" else f"{ln} Ventures")
    mem = random.choices(["standard","premium","vip"],[70,20,10])[0]
    phone = f"+27 7{random.randint(1,9)} {random.randint(100,999)} {random.randint(1000,9999)}"
    joined = TODAY - timedelta(days=random.randint(20,700))
    cust.append([f"C{1000+i}", f"{fn} {ln}", f"{fn.lower()}.{ln.lower().replace(' ','')}{i}@example.com", phone, city, prov, ctype, company, mem, "active", 0, random.choice([0,1,1]), phone[-4:], joined.isoformat(), 0])

# scenario seeds: fraud, locked, suspended
for idx in (6,27,58,83): cust[idx][10]=1
for idx in (13,41,72): cust[idx][9]="locked"
cust[90][9]="suspended"
cust[0][8]="vip"; cust[1][8]="premium"

orders=[]; pays=[]; refunds=[]; n=1
def add_order(ci, pid, odate, status, method="card", notes="", amt=None, refund_status="none", dup=False):
    global n
    p=P[pid]; amount=amt if amt is not None else p[3]
    num=f"H9-{10000+n}"; n+=1
    window=(odate+timedelta(days=14)).isoformat()
    deliv = odate if status in("enrolled","in_progress","completed") else None
    orders.append([num,cust[ci][0],pid,odate.isoformat(),amount,status,deliv.isoformat() if deliv else "",window,method,refund_status,notes])
    pays.append([f"TX{900000+len(pays)}",num,cust[ci][0],amount,odate.isoformat(),"settled",method])
    if dup: pays.append([f"TX{900000+len(pays)}",num,cust[ci][0],amount,odate.isoformat(),"settled",method])
    return num

for ci in range(100):
    for _ in range(random.choices([1,2,3],[55,35,10])[0]):
        pid = random.choices([p[0] for p in products],[22,15,12,18,6,6,4,12,5])[0]
        age = random.randint(1,120)
        if P[pid][5]: age=random.randint(1,60)
        odate = TODAY - timedelta(days=age)
        status = random.choices(["enrolled","in_progress","completed","cancelled"],[20,35,40,5])[0]
        if age<10 and status=="completed": status="enrolled"
        add_order(ci,pid,odate,status,random.choice(["card","card","eft","instant_eft"]))

# Hand-crafted test-case orders (deterministic scenarios)
add_order(0,"P002",TODAY-timedelta(days=3),"enrolled",notes="TEST: refund within 14-day window, R4,500 under approval limit")
add_order(1,"P002",TODAY-timedelta(days=40),"in_progress",notes="TEST: refund request after window expired")
add_order(2,"P009",TODAY-timedelta(days=2),"completed",notes="TEST: non-refundable digital download")
add_order(3,"P001",TODAY-timedelta(days=5),"enrolled",dup=True,notes="TEST: duplicate charge, two settled payments for one order")
add_order(4,"P007",TODAY-timedelta(days=6),"enrolled",amt=25000,notes="TEST: refund > R5,000 requires human approval; > R10,000 escalate")
add_order(5,"P005",TODAY-timedelta(days=9),"enrolled",notes="TEST: placement programme refund, R12,000 over limit")
add_order(6,"P003",TODAY-timedelta(days=4),"enrolled",notes="TEST: fraud-flagged customer requests refund")
add_order(7,"P004",TODAY-timedelta(days=20),"in_progress",notes="TEST: subscription renewal 20 days ago, past 14-day reversal limit")
add_order(8,"P002",TODAY-timedelta(days=7),"enrolled",refund_status="refunded",notes="TEST: already refunded once, only one refund per order")
add_order(9,"P001",TODAY-timedelta(days=1),"pending_access",notes="TEST: paid, but course access not delivered")
add_order(10,"P006",TODAY-timedelta(days=11),"enrolled",notes="TEST: SMB workshop, partial refund request")
add_order(11,"P008",TODAY-timedelta(days=13),"enrolled",notes="TEST: refund on day 13 of 14-day window (boundary)")
add_order(12,"P001",TODAY-timedelta(days=14),"enrolled",notes="TEST: refund on day 14 exactly (boundary)")
add_order(13,"P003",TODAY-timedelta(days=8),"enrolled",notes="TEST: locked account asks for refund")

c.executemany("INSERT INTO customers VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", cust)

for o in orders:
    if o[9]=="refunded":
        refunds.append([f"RF{700000+len(refunds)}",o[0],o[4],(TODAY-timedelta(days=3)).isoformat(),"completed"])

c.executemany("INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?)", orders)
c.executemany("INSERT INTO payments VALUES(?,?,?,?,?,?,?)", pays)
c.executemany("INSERT INTO refunds VALUES(?,?,?,?,?)", refunds)

cases=[]; cats=["refund","billing","access","account","other"]
for i,ci in enumerate(random.sample(range(100),20)):
    st=random.choice(["open","open","resolved","resolved","resolved"])
    cases.append([f"CS-{20000+i}",cust[ci][0],(TODAY-timedelta(days=random.randint(1,60))).isoformat(),random.choice(cats),st,"Mock historical case"])
    if st=="open": cust[ci][14]+=1

c.executemany("INSERT INTO support_cases VALUES(?,?,?,?,?,?)", cases)
for r in cust: c.execute("UPDATE customers SET open_cases=? WHERE customer_id=?", (r[14],r[0]))

pol=[
 ("POL-01","Refund window","Refunds allowed within 14 days of order_date. After that, explain policy and escalate only if the customer disputes.",None,0),
 ("POL-02","Non-refundable","Products with refundable = 0 (Downloadable Prompt Template Pack) cannot be refunded once delivered.",None,0),
 ("POL-03","Single refund","Only one refund per order. If refund_status = refunded, do not refund again.",None,0),
 ("POL-04","Refund approval limit","Refunds above R5,000 need human approval before processing.",5000,1),
 ("POL-05","Hard escalation limit","Refunds above R10,000 must be escalated; the agent must never process them.",10000,1),
 ("POL-06","Subscriptions","Subscription renewals cannot be reversed after 14 days.",None,0),
 ("POL-07","Fraud","If fraud_flag = 1, stop self-service and escalate to the Security queue.",None,1),
 ("POL-08","Locked or suspended accounts","Do not refund or change data on a locked or suspended account; escalate to Account Recovery.",None,1),
 ("POL-09","Duplicate charge","If two settled payments exist for one order, the duplicate may be refunded after verification; if the data conflicts, escalate.",None,0),
 ("POL-10","Verification","Before any refund or account change, the customer must give their email and the last 4 digits of their phone number, and both must match the record.",None,0),
 ("POL-11","Manager request","If the customer asks for a manager or mentions legal action, escalate immediately.",None,1),
 ("POL-13","Partial refunds","The agent does not process partial refunds. Escalate partial-refund requests with the amount requested.",None,1),
 ("POL-12","POPIA","Never reveal another person's data. Share only the verified customer's own record. Never display full phone numbers.",None,0),
]
c.executemany("INSERT INTO policies VALUES(?,?,?,?,?)", pol)
db.commit()

def dump(t, target_dir):
    cur=db.execute(f"SELECT * FROM {t}"); names=[d[0] for d in cur.description]
    with open(f"{target_dir}/{t}.csv","w",newline="") as f:
        w=csv.writer(f); w.writerow(names); w.writerows(cur.fetchall())

tables = ["customers","products","orders","payments","refunds","support_cases","policies"]
for t in tables:
    dump(t, ORIG_DIR)
    dump(t, WORK_DIR)
    dump(t, TEST_DIR)

print("Database and CSV files successfully populated in data_original, data_work, testing.")
