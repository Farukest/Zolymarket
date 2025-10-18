# 🎯 Admin Panel User Guide
**Zolymarket FHEVM - Encrypted Prediction Market Platform**

## Table of Contents
1. [Overview](#overview)
2. [Access & Permissions](#access--permissions)
3. [Dashboard Statistics](#dashboard-statistics)
4. [Bet Management](#bet-management)
5. [Category Management](#category-management)
6. [User Management](#user-management)
7. [Analytics](#analytics)
8. [System Settings](#system-settings)

---

## Overview

The Admin Panel is the central hub for managing your encrypted prediction market platform. It provides comprehensive tools for:

- **Bet Lifecycle Management**: Create, sync, assign categories, and resolve bets
- **Category Organization**: Create and organize market categories
- **User Administration**: Monitor user activities and permissions
- **Real-time Analytics**: Track platform metrics and performance
- **System Configuration**: Configure platform-wide settings

### Admin Panel Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN PANEL                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌───────────┐  ┌───────┐  ┌──────────┐       │
│  │   Bet    │  │ Category  │  │ Users │  │Analytics │       │ 
│  │Management│  │Management │  │       │  │          │       │ 
│  └──────────┘  └───────────┘  └───────┘  └──────────┘       │ 
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │              System Settings                       │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↓                                  ↓
    ┌─────────┐                      ┌──────────┐
    │Smart    │                      │MongoDB   │
    │Contract │                      │Database  │
    └─────────┘                      └──────────┘
```

---

## Access & Permissions

### Admin Authentication

**Location**: `frontend/src/utils/adminUtils.js`

```javascript
// Admin addresses are whitelisted in code
const ADMIN_ADDRESSES = {
  SUPER_ADMIN: '0x...',    // Full access
  CATEGORY_ADMIN: '0x...',  // Category management only
  BET_ADMIN: '0x...'        // Bet management only
};
```

### Access Control Flow

```
User connects wallet
         ↓
Check address in adminUtils.js
         ↓
    ┌─────────┐
    │Is Admin?│
    └─────────┘
         ↓
    YES  │  NO
    ↓    │    ↓
Enter    │  Show "Access Denied"
Admin    │  Redirect to home
Panel    │
```

### Permission Levels

| Role | Bet Management | Categories | Users | Analytics | Settings |
|------|----------------|------------|-------|-----------|----------|
| **Super Admin** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Bet Admin** | ✅ Full | ❌ View Only | ❌ No | ✅ View | ❌ No |
| **Category Admin** | ❌ View Only | ✅ Full | ❌ No | ✅ View | ❌ No |

### How to Add a New Admin

1. Open `frontend/src/utils/adminUtils.js`
2. Add wallet address to appropriate role:
   ```javascript
   export const SUPER_ADMINS = [
     '0xYourNewAdminAddress...',
   ];
   ```
3. Save and deploy frontend

---

## Dashboard Statistics

### Overview Cards

When you enter the Admin Panel, you see 5 key metrics:

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Bets   │ Active Bets  │ Total Users  │ Total Volume │ Categories   │
│      12      │       5      │      847     │  $12,450     │      8       │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### Statistics Data Sources

| Metric | Source | Update Frequency | Decryption Required |
|--------|--------|------------------|---------------------|
| **Total Bets** | Smart Contract | Real-time | ❌ No |
| **Active Bets** | Smart Contract | Real-time | ❌ No |
| **Total Users** | Smart Contract (`getUniqueTradersCount()`) | Real-time | ❌ No |
| **Total Volume** | Smart Contract (`globalTotalVolume`) | Real-time | ✅ Yes (FHEVM decrypt) |
| **Categories** | MongoDB Database | Real-time | ❌ No |

### Volume Decryption Process

```
1. Contract stores encrypted global volume (euint64)
         ↓
2. Admin Panel calls getFhevmInstance()
         ↓
3. Retrieve encrypted handle: globalTotalVolume
         ↓
4. Call instance.publicDecrypt([handle])
         ↓
5. Display decrypted volume: $12,450 USDC
```

**Code Reference**: `frontend/src/pages/Admin.jsx:76-86`

---

## Bet Management

### Main Features

The Bet Management tab provides:

1. **Blockchain Sync**: Import bets from smart contract to database
2. **Category Assignment**: Organize bets into categories
3. **Image Management**: Upload custom images for each bet
4. **Bet Resolution**: Declare winners and trigger payouts
5. **Filtering & Sorting**: Organize large bet lists
6. **Bet Creation**: Create new bets on-chain

### 4.1 Syncing Bets from Blockchain

#### When to Sync

- ✅ After deploying new bets on-chain
- ✅ After bet data changes on contract
- ✅ Periodically to keep database updated

#### Sync Process

```
┌──────────────────────────────────────────────────────────┐
│  1. Click "Sync Bets" button                             │
└──────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────┐
│  2. Frontend sends sync request to Backend               │
│     POST /api/bet-sync                                   │
│     Body: { contractAddress, rpcUrl, abi, chainId }      │
└──────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────┐
│  3. Backend connects to blockchain                       │
│     - Reads total bet count                              │
│     - Loops through all bet IDs                          │
│     - Fetches bet data (title, options, endTime, etc)    │
└──────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────┐
│  4. Backend updates MongoDB                              │
│     - Creates new bets                                   │
│     - Updates existing bets                              │
│     - Skips duplicates                                   │
└──────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────┐
│  5. Success Message                                      │
│     "✓ Synced 3 new bets, ↻ Updated 2 bets"              │
└──────────────────────────────────────────────────────────┘
```

#### Step-by-Step Instructions

**Step 1**: Navigate to Admin Panel → **Bet Management** tab

**Step 2**: Click the green **"Sync Bets"** button (top-right)

**Step 3**: Wait for sync to complete
- You'll see a loading spinner
- Status updates appear in real-time

**Step 4**: Review sync results
```
✓ 3 new bets synced
↻ 2 bets updated
✗ 0 failed
```

**Step 5**: Refresh page if needed (bets appear immediately in most cases)

#### Troubleshooting Sync Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Sync failed" | Backend not running | Check `npm run dev` in backend folder |
| "Invalid contract" | Wrong network | Verify you're on correct network (Sepolia) |
| "Database error" | MongoDB connection | Check MongoDB is running |
| Slow sync | Large bet count | Wait patiently, it processes ~10 bets/second |

---

### 4.2 Filtering & Sorting Bets

#### Filter Options

```
┌─────────────────────────────────────────────────────────────┐
│  Filter:  [All Categories ▼]  [All Status ▼]                │
│  Sort By: [ID ▼]  [↓]                      12 bets          │
└─────────────────────────────────────────────────────────────┘
```

#### Available Filters

| Filter Type | Options | Description |
|-------------|---------|-------------|
| **Category** | All Categories, Sports, Politics, Crypto, Entertainment, etc. | Show bets from specific category |
| **Status** | All, Active, Ended, Resolved | Filter by bet lifecycle stage |

#### Sort Options

| Sort By | Description |
|---------|-------------|
| **ID** | Contract bet ID (newest = highest) |
| **Name** | Alphabetical by bet title |
| **End Time** | Soonest ending first / Latest ending first |
| **Type** | Binary → Multiple → Nested |
| **Category** | Alphabetical by category name |

#### Sort Direction

- **↑ ASC**: Ascending (A→Z, 1→9, oldest→newest)
- **↓ DESC**: Descending (Z→A, 9→1, newest→oldest)

**Click the arrow icon to toggle**

---

### 4.3 Assigning Categories

#### Why Assign Categories?

- **Organization**: Users can browse bets by topic
- **Discoverability**: Categories appear on home page
- **Analytics**: Track performance by category

#### How to Assign

**Step 1**: Locate the bet you want to categorize

**Step 2**: Find the category dropdown on the right side of the bet card
```
┌───────────────────────────────┐
│ #5 - Will Bitcoin hit $100k?  │
│ Binary • 2d 5h left           │
│                               │
│  [📷 Image]  [No Category ▼]  │
└───────────────────────────────┘
```

**Step 3**: Click the dropdown and select a category
```
┌──────────────────────┐
│ No Category          │
│ ──────────────────   │
│ ⚽ Sports            │
│ 🏛️ Politics          │
│ 💰 Crypto             ← Select
│ 🎬 Entertainment     │
│ 🌍 World Events      │
└──────────────────────┘
```

**Step 4**: Success! Category is saved immediately
```
✅ Category updated to "Crypto"
```

#### Bulk Category Assignment

Currently not supported. Categories must be assigned one-by-one.

**Workaround**: Use filters to show only uncategorized bets:
1. Set Category filter to "No Category"
2. Assign categories one by one
3. They disappear from view once assigned

---

### 4.4 Image Management

#### Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WEBP (.webp)
- SVG (.svg)

**Maximum file size**: 5 MB

#### Upload Process

```
┌──────────────────────────────────────────┐
│  1. Click image placeholder or image     │
│     (Shows "Upload" text)                │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  2. Select image from your computer      │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  3. Image uploads automatically          │
│     (Shows loading spinner)              │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  4. Success! Image appears in card       │
│     Stored: /uploads/bet-images/xxx.webp │
└──────────────────────────────────────────┘
```

#### Step-by-Step Instructions

**Step 1**: Locate the bet that needs an image

**Step 2**: Click on the image area (gray box with "Upload" icon)

**Step 3**: Your file picker opens - select an image

**Step 4**: Wait for upload (automatic)
- You'll see "Uploading image..." text
- Preview appears immediately

**Step 5**: Done! Image is saved to server and database

#### Changing an Existing Image

**Same process**: Click the image → Select new file → Auto-upload

The old image is replaced automatically.

#### Where Images Are Stored

- **Server**: `backend/uploads/bet-images/`
- **Database**: MongoDB stores the path (`/uploads/bet-images/filename.webp`)
- **CDN**: Future enhancement (not implemented yet)

---

### 4.5 Resolving Bets

#### When to Resolve

✅ **Resolve when**:
- Bet end time has passed
- Real-world outcome is known
- You have verified the result

❌ **Don't resolve**:
- Bet is still active (unless emergency early resolution)
- Outcome is disputed or unclear
- You don't have authority to decide

#### Resolution Types

| Bet Type | Resolution Method |
|----------|-------------------|
| **Binary (Yes/No)** | Select winner: Option 0 (Yes) or Option 1 (No) |
| **Multiple Choice** | Select winning option index (0, 1, 2, ...) |
| **Nested (Multi-Market)** | Select option AND outcome (Yes/No) |

#### Binary/Multiple Choice Resolution

**Step 1**: Click the **checkmark icon** (✓) on the bet card

**Step 2**: Review bet details in modal
```
┌─────────────────────────────────────────┐
│  Resolve Bet                            │
│  #5 - Will Bitcoin hit $100k by 2025?   │
│                                         │
│  ⚠️ Warning: This action is permanent   │
│                                         │
│  Select Winning Option:                 │
│  ┌────────────────────────────────┐     │
│  │ -- Select Winner --        ▼   │     │
│  │ Option 1: Yes                  │     │
│  │ Option 2: No                   │     │
│  └────────────────────────────────┘     │
│                                         │
│  Bet Details:                           │
│  Type: Binary                           │
│  Total Bets: 247                        │
│  Options: 2                             │
│  End Time: Jan 1, 2025 12:00 AM         │
│  ✓ Bet ended - ready to resolve         │
│                                         │
│  [Cancel]  [Resolve Bet]                │
└─────────────────────────────────────────┘
```

**Step 3**: Select the winning option from dropdown

**Step 4**: Click **"Resolve Bet"**

**Step 5**: Confirm transaction in MetaMask

**Step 6**: Wait for blockchain confirmation

**Step 7**: Success! Winners are calculated
```
✅ Bet resolved successfully! Winner: Option 1
   TX: 0xabc123...

✅ Winners updated in DB: 143 won, 104 lost
```

#### Nested Bet Resolution

**Step 1**: Click checkmark icon (✓)

**Step 2**: Select BOTH option and outcome
```
┌─────────────────────────────────────────┐
│  Resolve Nested Bet                     │
│  #8 - NBA Finals 2024                   │
│                                         │
│  Select Option:                         │
│  ┌────────────────────────────────┐     │
│  │ Option 1: Lakers            ▼  │     │
│  │ Option 2: Celtics              │     │
│  │ Option 3: Nuggets              │     │
│  └────────────────────────────────┘     │
│                                         │
│  Select Outcome:                        │
│  ┌──────────────┬──────────────────┐    │
│  │  ✓ YES Wins  │  ✗ NO Wins       │    │
│  └──────────────┴──────────────────┘    │
│                                         │
│  You are resolving:                     │
│  Option 1 - YES wins                    │
│                                         │
│  [Cancel]  [Resolve Bet]                │
└─────────────────────────────────────────┘
```

**Step 3**: Choose the team/option that applies

**Step 4**: Choose the outcome:
- **YES Wins**: That option happened (Lakers won)
- **NO Wins**: That option didn't happen (Lakers lost)

**Step 5**: Confirm and wait for transaction

#### What Happens After Resolution

```
Contract Side:
  1. Bet is marked as resolved (isResolved = true)
  2. Winning option is stored
  3. Bet becomes unplayable
  4. Payout requests can now be made

Database Side (MongoDB):
  1. Winner/loser status calculated for all users
  2. User positions updated with isWinner flag
  3. Dashboard shows results immediately
  4. Winners see "Request Payout" button
  5. Losers see "You Lost" badge
```

#### Resolution Checklist

Before clicking "Resolve Bet":

- [ ] Bet end time has passed (or emergency resolution needed)
- [ ] Real-world outcome is confirmed
- [ ] You have selected the correct winner
- [ ] You understand this action is **permanent**
- [ ] Your wallet has ETH for gas fees
- [ ] You're connected to the correct network

---

### 4.6 Creating New Bets

#### Overview

Admins can create new bets directly from the admin panel without writing code or using Remix.

#### Create Bet Flow

```
1. Click "Create Bet" button
         ↓
2. Fill out bet form
   - Type (Binary/Multiple/Nested)
   - Title & Description
   - Options
   - End Time
   - Min/Max Bet
   - Liquidity
   - Category (optional)
         ↓
3. Approve USDC (if needed)
         ↓
4. Sign transaction
         ↓
5. Bet created on-chain
         ↓
6. Auto-sync to database
```

#### Step-by-Step Instructions

**Step 1**: Click **"Create Bet"** button (top-right, blue button)

**Step 2**: Choose bet type
```
┌─────────────────────────────────────────┐
│  Bet Type *                             │
│  ┌────────────────────────────────┐     │
│  │ Binary (Yes/No)            ▼   │     │
│  │ Multiple Choice                │     │
│  │ Nested (Multi-Market)          │     │
│  └────────────────────────────────┘     │
│                                         │
│  Simple yes/no question with 2 outcomes │
└─────────────────────────────────────────┘
```

**Type Descriptions**:
- **Binary**: Yes/No question (e.g., "Will it rain tomorrow?")
- **Multiple**: One winner from many options (e.g., "Who will win the election?")
- **Nested**: Each option has Yes/No sub-markets (e.g., NBA Finals - each team can win or lose)

**Step 3**: Enter bet details

| Field | Required | Example | Notes |
|-------|----------|---------|-------|
| **Title** | ✅ Yes | "Will Bitcoin reach $100k by end of 2025?" | Keep under 100 characters |
| **Description** | ✅ Yes | "Bet resolves YES if BTC price..." | Explain resolution criteria |
| **Options** | ✅ Yes | "Yes", "No" | Min 2 options. Add more for Multiple Choice |
| **End Time** | ✅ Yes | 2025-12-31 23:59 | Must be in the future |
| **Min Bet** | ✅ Yes | 1 USDC | Minimum bet users can place |
| **Max Bet** | ✅ Yes | 1000 USDC | Maximum bet users can place |
| **Liquidity** | ✅ Yes | 500 USDC | Your initial liquidity (returned after resolution) |
| **Category** | ❌ No | Crypto | Helps users find bet |

**Step 4**: Add options (for Multiple/Nested types)

- Click **"+ Add Option"** to add more
- Click **X** button to remove options
- Minimum: 2 options
- Maximum: No limit (but UI becomes crowded after 10)

**Step 5**: Review and approve USDC

If this is your first bet or you need more allowance:

```
┌─────────────────────────────────────────┐
│  ⚠️ Approval Required                   │
│  You need to approve 500 USDC for the   │
│  contract to spend before creating bet  │
│                                         │
│  [Approve USDC]                         │
└─────────────────────────────────────────┘
```

Click **"Approve USDC"** → Sign transaction → Wait for confirmation

**Step 6**: Create the bet

Once approved:
```
┌─────────────────────────────────────────┐
│  ✓ Ready: USDC allowance approved       │
│  You can now create the bet.            │
│                                         │
│  [Create Bet]                           │
└─────────────────────────────────────────┘
```

Click **"Create Bet"** → Sign transaction → Wait

**Step 7**: Auto-sync (happens automatically)

After bet is created:
1. Wait 2 seconds
2. System syncs with blockchain
3. Bet appears in list
4. Category is assigned automatically (if selected)

**Success Message**:
```
✅ Bet created successfully! Gas used: 2,847,392
✅ Bet synced successfully!
```

#### Create Bet Troubleshooting

| Issue | Solution |
|-------|----------|
| "Please connect wallet" | Connect MetaMask first |
| "Approval Required" | Click "Approve USDC" button |
| "Transaction failed" | Check you have enough ETH for gas |
| "Title is required" | Fill in all required fields |
| "End time must be in future" | Choose a future date/time |
| Bet created but not synced | Wait 10 seconds, then click "Sync Bets" manually |

---

## Category Management

### Overview

Categories help organize bets by topic, making it easier for users to find markets they're interested in.

### Category Features

- **Drag-and-drop reordering**: Change display order on homepage
- **Custom icons**: Emoji icons for visual identification
- **Color coding**: Each category has a unique color
- **Infinite categories**: No limit on category count

### Category Structure

```javascript
{
  _id: "507f1f77bcf86cd799439011",
  name: "Crypto",
  icon: "💰",
  color: "#3B82F6",
  displayOrder: 0,
  createdAt: "2024-01-15T10:30:00Z"
}
```

### 5.1 Creating Categories

**Step 1**: Navigate to **Categories** tab

**Step 2**: Fill out creation form
```
┌─────────────────────────────────────────────────────────┐
│  Create New Category                                    │
│  ┌──────────┬──────┬────────┬──────────┐                │
│  │ Name     │ Icon │ Color  │ [Create] │                │
│  ├──────────┼──────┼────────┼──────────┤                │
│  │ Crypto   │ 💰   │ 🎨Blue │          │                │
│  └──────────┴──────┴────────┴──────────┘                │
└─────────────────────────────────────────────────────────┘
```

**Step 3**: Enter category name (e.g., "Crypto", "Sports", "Politics")

**Step 4**: Click the emoji icon picker
- Browse or search for emoji
- Click to select

**Step 5**: Choose color
- Click color picker
- Select from palette or enter hex code

**Step 6**: Click **"Create"**

**Result**: Category appears in the list below

### 5.2 Editing Categories

**Step 1**: Find category in list

**Step 2**: Click **edit icon** (pencil)

**Step 3**: Inputs become editable
```
┌─────────────────────────────────────────────┐
│  ┌──────────┬──────┬────────┬─────────────┐ │
│  │ Name     │ Icon │ Color  │ [Save] [X]  │ │
│  ├──────────┼──────┼────────┼─────────────┤ │
│  │ Crypto   │ 💰   │ 🎨     │             │ │
│  └──────────┴──────┴────────┴─────────────┘ │
└─────────────────────────────────────────────┘
```

**Step 4**: Make changes

**Step 5**: Click **"Save"** or **X** to cancel

### 5.3 Reordering Categories

Categories appear on the homepage in **displayOrder** sequence.

**To reorder**:

1. Click and hold the **⋮⋮** grip icon on the left
2. Drag category up or down
3. Release to drop
4. Order saves automatically

**Visual feedback**:
- Cursor changes to grabbing hand
- Category follows your mouse
- Other categories shift to make space

### 5.4 Deleting Categories

**Warning**: Deleting a category does NOT delete bets in that category. Bets become uncategorized.

**Steps**:

1. Click **trash icon** (🗑️) next to category
2. Confirm deletion in browser alert
3. Category is removed from database

**What happens to bets**:
- Bets in that category: categoryId set to `null`
- Bets still exist and are playable
- They appear under "No Category" in filters

---

## User Management

### Overview

The User Management tab displays all users who have interacted with your platform.

**Data Source**: Smart contract (`uniqueTraders` mapping)

### User Table

```
┌──────────┬───────────────────┬─────────┬────────────────┬─────────┐
│ Address  │ Total Bets Placed │ Volume  │ Win/Loss Ratio │ Status  │
├──────────┼───────────────────┼─────────┼────────────────┼─────────┤
│ 0xABC... │        12         │ $1,245  │    8W / 4L     │ Active  │
│ 0xDEF... │         5         │  $890   │    2W / 3L     │ Active  │
│ 0x789... │        47         │ $8,920  │   31W / 16L    │ Active  │
└──────────┴───────────────────┴─────────┴────────────────┴─────────┘
```

### User Information

| Column | Description | Source |
|--------|-------------|--------|
| **Address** | User's wallet address | Blockchain |
| **Total Bets** | Number of bets placed | MongoDB (aggregated) |
| **Volume** | Total USDC wagered | MongoDB (aggregated) |
| **Win/Loss** | Winning vs losing bets | MongoDB (resolved bets only) |
| **Status** | Active / Inactive / Banned | MongoDB |

### User Actions

Currently, the User Management tab is **view-only**. Future features:

- [ ] Ban/unban users
- [ ] View user's bet history
- [ ] Export user data
- [ ] Contact user (if email provided)

---

## Analytics

### Overview

The Analytics tab provides insights into platform performance and user behavior.

### 7.1 Overview Metrics

```
┌─────────────────────────────────────────────────────────┐
│  Platform Analytics                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Total Volume │  │ Total Bets   │  │ Active Users │   │
│  │   $45,890    │  │     247      │  │     1,834    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Avg Bet     │  │  Win Rate    │  │ Liquidity    │   │
│  │   $185.77    │  │     58.3%    │  │  $12,500     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Charts

#### Volume Over Time

Line chart showing daily/weekly/monthly volume trends.

```
 Volume ($)
   ↑
10k│              ╱╲
   │            ╱    ╲
 5k│        ╱╲╱        ╲╱╲
   │    ╱╲╱                ╲
 0k└──────────────────────────→ Time
    Mon  Tue  Wed  Thu  Fri
```

#### Category Distribution

Pie chart showing bet distribution by category.

```
       Sports (35%)
         ╱╲
    Crypto  Politics
    (25%)    (20%)

  Entertainment    World
     (15%)         (5%)
```

#### User Activity

Bar chart showing daily active users.

```
Users
  ↑
500│     ▓▓
   │     ▓▓  ▓▓
300│  ▓▓ ▓▓  ▓▓ ▓▓
   │  ▓▓ ▓▓  ▓▓ ▓▓
100│  ▓▓ ▓▓  ▓▓ ▓▓ ▓▓
  0└───────────────────→
    Mon Tue Wed Thu Fri
```

### 7.3 Top Performers

#### Most Popular Bets

| Rank | Bet Title | Category | Volume | Participants |
|------|-----------|----------|--------|--------------|
| 1 | Bitcoin to $100k? | Crypto | $12,450 | 847 |
| 2 | Lakers win NBA? | Sports | $8,920 | 623 |
| 3 | Trump wins 2024? | Politics | $7,530 | 891 |

#### Top Traders

| Rank | Address | Win Rate | Total Volume | Total Bets |
|------|---------|----------|--------------|------------|
| 1 | 0xABC... | 72.3% | $8,920 | 47 |
| 2 | 0xDEF... | 68.9% | $6,450 | 34 |
| 3 | 0x789... | 65.2% | $5,230 | 29 |

---

## System Settings

### Overview

System Settings control platform-wide configuration and parameters.

### 8.1 Available Settings

```
┌─────────────────────────────────────────────┐
│  System Settings                            │
├─────────────────────────────────────────────┤
│                                             │
│  Platform Configuration                     │
│  ┌────────────────────────────────────┐     │
│  │ Platform Name                      │     │
│  │ [Zolymarket FHEVM]                 │     │
│  └────────────────────────────────────┘     │
│                                             │
│  ┌────────────────────────────────────┐     │
│  │ Platform Fee (%)                   │     │
│  │ [2.5]                              │     │
│  └────────────────────────────────────┘     │
│                                             │
│  ┌────────────────────────────────────┐     │
│  │ Minimum Bet (USDC)                 │     │
│  │ [1]                                │     │
│  └────────────────────────────────────┘     │
│                                             │
│  ┌────────────────────────────────────┐     │
│  │ Maximum Bet (USDC)                 │     │
│  │ [10000]                            │     │
│  └────────────────────────────────────┘     │
│                                             │
│  [Save Changes]                             │
└─────────────────────────────────────────────┘
```

### 8.2 Configuration Parameters

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| **Platform Name** | String | "Zolymarket FHEVM" | Displayed in header/footer |
| **Platform Fee** | Number (%) | 2.5 | Fee taken from total pool |
| **Min Bet** | Number (USDC) | 1 | Global minimum bet |
| **Max Bet** | Number (USDC) | 10000 | Global maximum bet |
| **Enable Registration** | Boolean | true | Allow new users |
| **Maintenance Mode** | Boolean | false | Disable betting temporarily |

### 8.3 Network Configuration

**Current Network**: Sepolia Testnet

**Contract Addresses**:
```javascript
{
  BET_MARKET_CORE: "0x...",
  BET_MARKET_PAYOUT: "0x...",
  BET_MARKET_STATS: "0x...",
  USDC_TOKEN: "0x..."
}
```

**Location**: `frontend/src/config/contracts.js`

**To change network**:
1. Edit `contracts.js`
2. Update contract addresses
3. Deploy frontend

### 8.4 Database Configuration

**MongoDB Connection**: Configured via environment variables

**Backend** `.env`:
```bash
MONGODB_URI=mongodb://localhost:27017/zolymarket
```

**Collections**:
- `bets`: Bet metadata and sync data
- `categories`: Category list
- `userpositions`: User bet positions and win/loss tracking

---

## Troubleshooting

### Common Issues

#### Issue: "Access Denied"

**Cause**: Your wallet address is not whitelisted as admin

**Solution**:
1. Check `frontend/src/utils/adminUtils.js`
2. Add your address to appropriate admin array
3. Redeploy frontend

#### Issue: "Sync Bets" fails

**Causes**:
- Backend not running
- Wrong network selected
- MongoDB not connected

**Solutions**:
1. Check backend is running: `npm run dev` in `backend/` folder
2. Check MetaMask is on Sepolia network
3. Check MongoDB is running: `mongod --version`

#### Issue: Images not uploading

**Causes**:
- File too large (>5MB)
- Wrong file format
- Backend uploads folder doesn't exist

**Solutions**:
1. Compress image before uploading
2. Use JPEG/PNG/WEBP formats only
3. Check `backend/uploads/bet-images/` folder exists

#### Issue: "Resolve Bet" transaction fails

**Causes**:
- Bet hasn't ended yet
- Already resolved
- Insufficient gas

**Solutions**:
1. Check bet end time has passed
2. Check bet's `isResolved` status
3. Ensure you have ETH for gas fees

---

## Best Practices

### 1. Regular Bet Syncing

- Sync bets **daily** to keep database updated
- Sync immediately after creating bets
- Sync before resolving bets

### 2. Category Organization

- Keep categories broad and general
- Use clear, recognizable icons
- Limit to 8-12 categories for best UX

### 3. Bet Resolution

- Only resolve after outcome is confirmed
- Double-check winning option before confirming
- Resolve promptly after bet ends (users waiting for payouts)

### 4. Image Best Practices

- Use 16:9 aspect ratio images (1920x1080px ideal)
- Compress images before uploading
- Use relevant, eye-catching images
- Avoid copyrighted content

### 5. Monitoring

- Check Analytics daily
- Monitor user complaints
- Review unresolved ended bets weekly

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + /` | Open search |
| `Esc` | Close modals |
| `Tab` | Navigate form fields |
| `Enter` | Submit forms |

---

## Support & Resources

- **Technical Documentation**: `FHEVM_INTEGRATION.md`
- **User Guide**: `USER_GUIDE.md`
- **Smart Contract Docs**: `/hardhat/contracts/`
- **API Docs**: `/backend/README.md`

---

**Last Updated**: January 2025
**Version**: 1.0.0
