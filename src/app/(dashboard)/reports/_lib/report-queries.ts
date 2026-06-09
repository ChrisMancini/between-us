import type { PipelineStage } from "mongoose";

interface DateRange {
  start: Date;
  end: Date;
}

export function tagPersonPipeline(
  dateRange: DateRange,
  opts?: { includeCount?: boolean }
): PipelineStage[] {
  const groupStage: PipelineStage.Group = {
    $group: {
      _id: {
        tagPath: "$tagDocs.path",
        tagSortOrder: "$tagDocs.sortOrder",
        paidBy: "$paidBy",
      },
      total: { $sum: "$amount" },
      ...(opts?.includeCount && { count: { $sum: 1 } }),
    },
  };

  return [
    { $match: { date: { $gte: dateRange.start, $lt: dateRange.end } } },
    {
      $lookup: {
        from: "tags",
        localField: "tags",
        foreignField: "_id",
        as: "tagDocs",
      },
    },
    { $unwind: "$tagDocs" },
    groupStage,
    { $sort: { "_id.tagSortOrder": 1, "_id.paidBy": 1 } },
  ];
}

export function trendPipeline(dateRange: DateRange): PipelineStage[] {
  return [
    { $match: { date: { $gte: dateRange.start, $lt: dateRange.end } } },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
          settlementType: "$settlementType",
        },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ];
}
